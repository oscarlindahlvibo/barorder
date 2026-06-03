import { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Check, ClipboardList, Loader2, LogOut, Paperclip, Plus, ShoppingBasket, Tag, X } from 'lucide-react';
import { AppUser, PlanningAttachment, PlanningChecklistItem, PlanningPriority, PlanningTask, PlanningTaskStatus, ShoppingItem, supabase } from '../lib/supabase';
import { useApp } from '../lib/store';
import RoleMenuButton from './RoleMenuButton';

const TASK_STATUSES: { id: PlanningTaskStatus; label: string; className: string }[] = [
  { id: 'todo', label: 'Att göra', className: 'border-gray-700 bg-gray-950' },
  { id: 'in_progress', label: 'Arbete pågår', className: 'border-orange-500/50 bg-orange-500/10' },
  { id: 'done', label: 'Slutfört', className: 'border-green-500/50 bg-green-500/10' },
  { id: 'external', label: 'Extern utförare', className: 'border-blue-500/50 bg-blue-500/10' },
];

const PRIORITY_LABELS: Record<PlanningPriority, string> = {
  low: 'Låg',
  normal: 'Normal',
  high: 'Hög',
};

const DEFAULT_TASK_FORM = {
  title: '',
  description: '',
  status: 'todo' as PlanningTaskStatus,
  assignee_id: '',
  due_date: '',
  priority: 'normal' as PlanningPriority,
};

const DEFAULT_ITEM_FORM = {
  product_name: '',
  quantity: '',
  store: '',
  assignee_id: '',
  note: '',
};

function formatDate(date: string | null) {
  if (!date) return 'Ingen deadline';
  return new Date(date).toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function assigneeName(users: AppUser[], id: string | null) {
  if (!id) return 'Ej tilldelad';
  return users.find(user => user.id === id)?.name || 'Okänd';
}

function priorityClass(priority: PlanningPriority) {
  if (priority === 'high') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (priority === 'low') return 'bg-gray-800 text-gray-400 border-gray-700';
  return 'bg-orange-500/15 text-orange-300 border-orange-500/30';
}

function createLocalId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTask(task: PlanningTask): PlanningTask {
  return {
    ...task,
    tags: Array.isArray(task.tags) ? task.tags : [],
    checklist: Array.isArray(task.checklist) ? task.checklist : [],
    attachments: Array.isArray(task.attachments) ? task.attachments : [],
  };
}

function checklistProgress(task: PlanningTask) {
  const done = task.checklist.filter(item => item.done).length;
  return `${done}/${task.checklist.length}`;
}

export default function EventPlanningDashboard() {
  const { currentUser, logout } = useApp();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [tasks, setTasks] = useState<PlanningTask[]>([]);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [taskForm, setTaskForm] = useState(DEFAULT_TASK_FORM);
  const [itemForm, setItemForm] = useState(DEFAULT_ITEM_FORM);
  const [savingTask, setSavingTask] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [showArchivedTasks, setShowArchivedTasks] = useState(false);
  const [showArchivedItems, setShowArchivedItems] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState('all');
  const [newChecklistText, setNewChecklistText] = useState('');
  const [newTagText, setNewTagText] = useState('');
  const [attachmentName, setAttachmentName] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const load = useCallback(async () => {
    const [usersResult, tasksResult, itemsResult] = await Promise.all([
      supabase.from('users').select('*').eq('active', true).order('name'),
      supabase.from('planning_tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('shopping_items').select('*').order('store').order('created_at', { ascending: false }),
    ]);
    setUsers(usersResult.data || []);
    setTasks((tasksResult.data || []).map((task: PlanningTask) => normalizeTask(task)));
    setItems(itemsResult.data || []);
  }, []);

  useEffect(() => {
    load();

    const taskChannel = supabase
      .channel('event-planning-tasks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'planning_tasks' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'planning_tasks' }, load)
      .subscribe();
    const itemChannel = supabase
      .channel('event-planning-shopping')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'shopping_items' }, load)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shopping_items' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(taskChannel);
      supabase.removeChannel(itemChannel);
    };
  }, [load]);

  async function createTask() {
    if (!taskForm.title.trim() || savingTask) return;
    setSavingTask(true);
    await supabase.from('planning_tasks').insert({
      title: taskForm.title.trim(),
      description: taskForm.description.trim() || null,
      status: taskForm.status,
      assignee_id: taskForm.assignee_id || null,
      due_date: taskForm.due_date || null,
      priority: taskForm.priority,
      tags: [],
      checklist: [],
      attachments: [],
      created_by: currentUser?.id || null,
    });
    setTaskForm(DEFAULT_TASK_FORM);
    await load();
    setSavingTask(false);
  }

  async function updateTask(task: PlanningTask, values: Partial<PlanningTask>) {
    await supabase.from('planning_tasks').update(values).eq('id', task.id);
    load();
  }

  async function updateSelectedTask(values: Partial<PlanningTask>) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, values);
  }

  async function addChecklistItem() {
    const task = tasks.find(item => item.id === selectedTaskId);
    const text = newChecklistText.trim();
    if (!task || !text) return;
    const checklist: PlanningChecklistItem[] = [...task.checklist, { id: createLocalId('check'), text, done: false }];
    setNewChecklistText('');
    await updateTask(task, { checklist });
  }

  async function toggleChecklistItem(itemId: string) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, {
      checklist: task.checklist.map(item => item.id === itemId ? { ...item, done: !item.done } : item),
    });
  }

  async function removeChecklistItem(itemId: string) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, { checklist: task.checklist.filter(item => item.id !== itemId) });
  }

  async function addTag() {
    const task = tasks.find(item => item.id === selectedTaskId);
    const tag = newTagText.trim();
    if (!task || !tag || task.tags.includes(tag)) return;
    setNewTagText('');
    await updateTask(task, { tags: [...task.tags, tag] });
  }

  async function removeTag(tag: string) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, { tags: task.tags.filter(item => item !== tag) });
  }

  async function addAttachment(attachment: PlanningAttachment) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, { attachments: [...task.attachments, attachment] });
  }

  async function addLinkAttachment() {
    const name = attachmentName.trim();
    const url = attachmentUrl.trim();
    if (!name || !url) return;
    setAttachmentName('');
    setAttachmentUrl('');
    await addAttachment({ id: createLocalId('attach'), name, url });
  }

  async function handleFileAttachment(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      await addAttachment({ id: createLocalId('file'), name: file.name, url: reader.result });
    };
    reader.readAsDataURL(file);
  }

  async function removeAttachment(id: string) {
    const task = tasks.find(item => item.id === selectedTaskId);
    if (!task) return;
    await updateTask(task, { attachments: task.attachments.filter(item => item.id !== id) });
  }

  async function createItem() {
    if (!itemForm.product_name.trim() || savingItem) return;
    setSavingItem(true);
    await supabase.from('shopping_items').insert({
      product_name: itemForm.product_name.trim(),
      quantity: itemForm.quantity.trim(),
      store: itemForm.store.trim() || 'Övrigt',
      assignee_id: itemForm.assignee_id || null,
      note: itemForm.note.trim() || null,
      created_by: currentUser?.id || null,
    });
    setItemForm(DEFAULT_ITEM_FORM);
    await load();
    setSavingItem(false);
  }

  async function updateItem(item: ShoppingItem, values: Partial<ShoppingItem>) {
    await supabase.from('shopping_items').update(values).eq('id', item.id);
    load();
  }

  const allTags = Array.from(new Set(tasks.flatMap(task => task.tags))).sort((a, b) => a.localeCompare(b, 'sv'));
  const visibleTasks = tasks
    .filter(task => task.archived === showArchivedTasks)
    .filter(task => tagFilter === 'all' || task.tags.includes(tagFilter));
  const visibleItems = items.filter(item => item.archived === showArchivedItems);
  const selectedTask = selectedTaskId ? tasks.find(task => task.id === selectedTaskId) || null : null;
  const itemsByStore = useMemo(() => (
    visibleItems.reduce<Record<string, ShoppingItem[]>>((groups, item) => {
      const store = item.store || 'Övrigt';
      groups[store] = [...(groups[store] || []), item];
      return groups;
    }, {})
  ), [visibleItems]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 sticky top-0 z-10 safe-area-inset-top">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold">Evenemangsplanering</h1>
            <p className="text-gray-400 text-sm">{currentUser?.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <RoleMenuButton />
            <button
              onClick={logout}
              className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
              aria-label="Logga ut"
              title="Logga ut"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-4">
        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl border border-orange-500/40 bg-orange-500/15 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-orange-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">Nytt arbetskort</h2>
              <p className="text-sm text-gray-400">Skapa uppgifter och tilldela ansvarig.</p>
            </div>
            <button
              onClick={() => setShowArchivedTasks(value => !value)}
              className={`h-10 px-3 rounded-lg border text-sm font-semibold ${
                showArchivedTasks ? 'bg-orange-500 border-orange-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {showArchivedTasks ? 'Visa aktiva kort' : 'Visa arkiv'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              value={taskForm.title}
              onChange={e => setTaskForm(form => ({ ...form, title: e.target.value }))}
              placeholder="Titel"
              className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
            />
            <select
              value={taskForm.assignee_id}
              onChange={e => setTaskForm(form => ({ ...form, assignee_id: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="">Ansvarig</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <input
              value={taskForm.due_date}
              onChange={e => setTaskForm(form => ({ ...form, due_date: e.target.value }))}
              type="date"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            />
            <select
              value={taskForm.priority}
              onChange={e => setTaskForm(form => ({ ...form, priority: e.target.value as PlanningPriority }))}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
            >
              <option value="low">Låg</option>
              <option value="normal">Normal</option>
              <option value="high">Hög</option>
            </select>
            <button
              onClick={createTask}
              disabled={!taskForm.title.trim() || savingTask}
              className="h-11 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            >
              {savingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Kort
            </button>
          </div>
          <textarea
            value={taskForm.description}
            onChange={e => setTaskForm(form => ({ ...form, description: e.target.value }))}
            placeholder="Beskrivning"
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500 resize-none"
          />
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <label className="sm:w-72">
              <span className="text-gray-500 text-xs font-semibold uppercase tracking-wide">Filtrera på tagg</span>
              <select
                value={tagFilter}
                onChange={e => setTagFilter(e.target.value)}
                className="mt-1 w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
              >
                <option value="all">Alla taggar</option>
                {allTags.map(tag => <option key={tag} value={tag}>{tag}</option>)}
              </select>
            </label>
            <p className="text-sm text-gray-500 sm:pt-6">
              Visar {visibleTasks.length} kort.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-4 gap-3">
          {TASK_STATUSES.map(status => {
            const columnTasks = visibleTasks.filter(task => task.status === status.id);
            return (
              <div key={status.id} className={`rounded-xl border p-3 min-h-40 ${status.className}`}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-black">{status.label}</h3>
                  <span className="rounded-full bg-gray-900 border border-gray-800 px-2 py-0.5 text-sm font-bold">{columnTasks.length}</span>
                </div>
                <div className="space-y-2">
                  {columnTasks.map(task => (
                    <article key={task.id} className="rounded-lg border border-gray-800 bg-gray-900 p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-white leading-snug">{task.title}</h4>
                        <span className={`flex-shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${priorityClass(task.priority)}`}>
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </div>
                      {task.description && <p className="text-sm text-gray-400 whitespace-pre-wrap">{task.description}</p>}
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>Ansvarig: {assigneeName(users, task.assignee_id)}</p>
                        <p>Deadline: {formatDate(task.due_date)}</p>
                      </div>
                      {task.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map(tag => (
                            <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-gray-700 bg-gray-950 px-2 py-0.5 text-xs text-gray-300">
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        {task.checklist.length > 0 && <span>Checklista {checklistProgress(task)}</span>}
                        {task.attachments.length > 0 && <span>{task.attachments.length} bilagor</span>}
                      </div>
                      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
                        <select
                          value={task.status}
                          onChange={e => updateTask(task, { status: e.target.value as PlanningTaskStatus })}
                          className="min-w-0 h-9 bg-gray-800 border border-gray-700 rounded-lg px-2 text-sm text-white focus:outline-none focus:border-orange-500"
                        >
                          {TASK_STATUSES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                        </select>
                        <button
                          onClick={() => setSelectedTaskId(task.id)}
                          className="h-9 px-3 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-sm font-semibold"
                        >
                          Öppna
                        </button>
                        <button
                          onClick={() => updateTask(task, { archived: !task.archived })}
                          className="h-9 w-9 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center"
                          aria-label={task.archived ? 'Återställ kort' : 'Arkivera kort'}
                          title={task.archived ? 'Återställ kort' : 'Arkivera kort'}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>
                    </article>
                  ))}
                  {columnTasks.length === 0 && <p className="text-sm text-gray-600 text-center py-6">Inga kort</p>}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl border border-gray-800 bg-gray-900 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl border border-green-500/40 bg-green-500/15 flex items-center justify-center">
              <ShoppingBasket className="w-5 h-5 text-green-300" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">Inköpslista</h2>
              <p className="text-sm text-gray-400">Grupperad per butik och enkel att checka av.</p>
            </div>
            <button
              onClick={() => setShowArchivedItems(value => !value)}
              className={`h-10 px-3 rounded-lg border text-sm font-semibold ${
                showArchivedItems ? 'bg-green-600 border-green-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {showArchivedItems ? 'Visa aktiva inköp' : 'Visa arkiv'}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
            <input
              value={itemForm.product_name}
              onChange={e => setItemForm(form => ({ ...form, product_name: e.target.value }))}
              placeholder="Produkt"
              className="md:col-span-2 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
            <input
              value={itemForm.quantity}
              onChange={e => setItemForm(form => ({ ...form, quantity: e.target.value }))}
              placeholder="Antal"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
            <input
              value={itemForm.store}
              onChange={e => setItemForm(form => ({ ...form, store: e.target.value }))}
              placeholder="Butik"
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
            />
            <select
              value={itemForm.assignee_id}
              onChange={e => setItemForm(form => ({ ...form, assignee_id: e.target.value }))}
              className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-green-500"
            >
              <option value="">Ansvarig</option>
              {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <button
              onClick={createItem}
              disabled={!itemForm.product_name.trim() || savingItem}
              className="h-11 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-white font-bold flex items-center justify-center gap-2"
            >
              {savingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Inköp
            </button>
          </div>
          <input
            value={itemForm.note}
            onChange={e => setItemForm(form => ({ ...form, note: e.target.value }))}
            placeholder="Anteckning"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {Object.entries(itemsByStore).map(([store, storeItems]) => (
              <div key={store} className="rounded-xl border border-gray-800 bg-gray-950">
                <div className="px-3 py-2 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="font-black text-white">{store}</h3>
                  <span className="text-sm text-gray-500">{storeItems.length} rader</span>
                </div>
                <div className="divide-y divide-gray-800">
                  {storeItems.map(item => (
                    <div key={item.id} className={`p-3 flex items-start gap-3 ${item.purchased ? 'opacity-60' : ''}`}>
                      <button
                        onClick={() => updateItem(item, { purchased: !item.purchased })}
                        className={`mt-0.5 h-7 w-7 rounded-lg border flex items-center justify-center ${
                          item.purchased ? 'bg-green-600 border-green-500 text-white' : 'border-gray-700 text-gray-600 hover:text-white'
                        }`}
                        aria-label={item.purchased ? 'Markera som ej inköpt' : 'Markera som inköpt'}
                      >
                        {item.purchased && <Check className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={`font-semibold ${item.purchased ? 'line-through text-gray-500' : 'text-white'}`}>{item.product_name}</p>
                        <p className="text-sm text-gray-500">{item.quantity || 'Antal saknas'} · {assigneeName(users, item.assignee_id)}</p>
                        {item.note && <p className="text-sm text-gray-400 mt-1">{item.note}</p>}
                      </div>
                      <button
                        onClick={() => updateItem(item, { archived: !item.archived })}
                        className="h-9 w-9 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center"
                        aria-label={item.archived ? 'Återställ inköpsrad' : 'Arkivera inköpsrad'}
                        title={item.archived ? 'Återställ inköpsrad' : 'Arkivera inköpsrad'}
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {visibleItems.length === 0 && (
              <div className="lg:col-span-2 rounded-xl border border-gray-800 bg-gray-950 px-4 py-10 text-center text-gray-600">
                Inga inköpsrader att visa.
              </div>
            )}
          </div>
        </section>
      </main>

      {selectedTask && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto bg-gray-900 border border-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black text-white">{selectedTask.title}</h2>
                <p className="text-sm text-gray-500">
                  {assigneeName(users, selectedTask.assignee_id)} · {formatDate(selectedTask.due_date)}
                </p>
              </div>
              <button
                onClick={() => setSelectedTaskId(null)}
                className="h-10 w-10 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 flex items-center justify-center"
                aria-label="Stäng kort"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-5">
              <section className="space-y-2">
                <h3 className="font-bold text-white">Grundinfo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <select
                    value={selectedTask.status}
                    onChange={e => updateSelectedTask({ status: e.target.value as PlanningTaskStatus })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  >
                    {TASK_STATUSES.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                  </select>
                  <select
                    value={selectedTask.assignee_id || ''}
                    onChange={e => updateSelectedTask({ assignee_id: e.target.value || null })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="">Ansvarig</option>
                    {users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}
                  </select>
                  <select
                    value={selectedTask.priority}
                    onChange={e => updateSelectedTask({ priority: e.target.value as PlanningPriority })}
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                  >
                    <option value="low">Låg</option>
                    <option value="normal">Normal</option>
                    <option value="high">Hög</option>
                  </select>
                </div>
                <input
                  value={selectedTask.due_date || ''}
                  onChange={e => updateSelectedTask({ due_date: e.target.value || null })}
                  type="date"
                  className="w-full sm:w-56 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-orange-500"
                />
                {selectedTask.description && (
                  <p className="rounded-xl border border-gray-800 bg-gray-950 p-3 text-gray-300 whitespace-pre-wrap">
                    {selectedTask.description}
                  </p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-bold text-white">Checklista</h3>
                <div className="space-y-2">
                  {selectedTask.checklist.map(item => (
                    <div key={item.id} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                      <button
                        onClick={() => toggleChecklistItem(item.id)}
                        className={`h-7 w-7 rounded-lg border flex items-center justify-center ${
                          item.done ? 'bg-green-600 border-green-500 text-white' : 'border-gray-700 text-gray-600 hover:text-white'
                        }`}
                        aria-label={item.done ? 'Markera ej klar' : 'Markera klar'}
                      >
                        {item.done && <Check className="w-4 h-4" />}
                      </button>
                      <span className={`flex-1 text-sm ${item.done ? 'line-through text-gray-500' : 'text-white'}`}>{item.text}</span>
                      <button onClick={() => removeChecklistItem(item.id)} className="h-8 w-8 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800" aria-label="Ta bort checklistpunkt">
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  ))}
                  {selectedTask.checklist.length === 0 && <p className="text-sm text-gray-600">Ingen checklista ännu.</p>}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newChecklistText}
                    onChange={e => setNewChecklistText(e.target.value)}
                    placeholder="Ny punkt"
                    className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={addChecklistItem} disabled={!newChecklistText.trim()} className="h-11 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold">
                    Lägg till
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-bold text-white">Taggar</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTask.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-sm text-orange-200">
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 text-orange-200/70 hover:text-white" aria-label={`Ta bort ${tag}`}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {selectedTask.tags.length === 0 && <p className="text-sm text-gray-600">Inga taggar ännu.</p>}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newTagText}
                    onChange={e => setNewTagText(e.target.value)}
                    placeholder="Ny tagg"
                    className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={addTag} disabled={!newTagText.trim()} className="h-11 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold">
                    Lägg till
                  </button>
                </div>
              </section>

              <section className="space-y-3">
                <h3 className="font-bold text-white">Bilagor</h3>
                <div className="space-y-2">
                  {selectedTask.attachments.map(attachment => (
                    <div key={attachment.id} className="flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-3 py-2">
                      <Paperclip className="w-4 h-4 text-gray-500" />
                      <a href={attachment.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 text-sm text-orange-300 hover:text-orange-200 truncate">
                        {attachment.name}
                      </a>
                      <button onClick={() => removeAttachment(attachment.id)} className="h-8 w-8 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800" aria-label="Ta bort bilaga">
                        <X className="w-4 h-4 mx-auto" />
                      </button>
                    </div>
                  ))}
                  {selectedTask.attachments.length === 0 && <p className="text-sm text-gray-600">Inga bilagor ännu.</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                  <input
                    value={attachmentName}
                    onChange={e => setAttachmentName(e.target.value)}
                    placeholder="Bilagenamn"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <input
                    value={attachmentUrl}
                    onChange={e => setAttachmentUrl(e.target.value)}
                    placeholder="Länk"
                    className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500"
                  />
                  <button onClick={addLinkAttachment} disabled={!attachmentName.trim() || !attachmentUrl.trim()} className="h-11 px-4 rounded-xl bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white font-bold">
                    Lägg till
                  </button>
                </div>
                <label className="block">
                  <span className="text-sm text-gray-400">Eller välj fil</span>
                  <input
                    type="file"
                    onChange={e => {
                      handleFileAttachment(e.target.files?.[0] || null);
                      e.currentTarget.value = '';
                    }}
                    className="mt-1 block w-full text-sm text-gray-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gray-800 file:px-3 file:py-2 file:text-gray-200 hover:file:bg-gray-700"
                  />
                </label>
              </section>

              <button
                onClick={() => updateSelectedTask({ archived: !selectedTask.archived })}
                className="w-full h-11 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white font-bold flex items-center justify-center gap-2"
              >
                <Archive className="w-4 h-4" />
                {selectedTask.archived ? 'Återställ kort' : 'Arkivera kort'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
