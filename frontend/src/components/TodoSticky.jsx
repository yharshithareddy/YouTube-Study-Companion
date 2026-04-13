import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, SectionHeader } from './ui';

const STORAGE_KEYS = {
  todos: 'studycomp_todos_v1',
  stickies: 'studycomp_stickies_v1'
};

function TodoSticky({ onNotify, sessionId = null, forcedTab = null, hideToggle = false, compactHeader = false }) {
  const [activeTab, setActiveTab] = useState(forcedTab || 'todo');
  const [todos, setTodos] = useState([]);
  const [stickies, setStickies] = useState([]);
  const [todoInput, setTodoInput] = useState('');
  const [stickyBody, setStickyBody] = useState('');
  const [draftStickyId, setDraftStickyId] = useState(null);
  const notifiedDraftRef = useRef(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    saveToStorage('todos', todos);
  }, [todos]);

  useEffect(() => {
    saveToStorage('stickies', stickies);
  }, [stickies]);

  useEffect(() => {
    if (forcedTab) setActiveTab(forcedTab);
  }, [forcedTab]);

  useEffect(() => {
    if (activeTab !== 'sticky') return undefined;
    const trimmed = stickyBody.trim();
    if (!trimmed) return undefined;

    const timer = window.setTimeout(() => {
      setStickies((current) => {
        if (draftStickyId) {
          return current.map((sticky) =>
            sticky.id === draftStickyId ? { ...sticky, body: trimmed, updatedAt: Date.now() } : sticky
          );
        }

        const nextSticky = {
          id: generateId(),
          body: trimmed,
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        setDraftStickyId(nextSticky.id);
        notifiedDraftRef.current = true;
        return [nextSticky, ...current];
      });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activeTab, draftStickyId, onNotify, stickyBody]);

  const completedCount = useMemo(() => todos.filter((todo) => todo.done).length, [todos]);

  const loadFromStorage = () => {
    try {
      const todosData = localStorage.getItem(STORAGE_KEYS.todos);
      if (todosData) {
        const parsed = JSON.parse(todosData);
        if (Array.isArray(parsed)) setTodos(parsed);
      }
    } catch {
      setTodos([]);
    }

    try {
      const stickiesData = localStorage.getItem(STORAGE_KEYS.stickies);
      if (stickiesData) {
        const parsed = JSON.parse(stickiesData);
        if (Array.isArray(parsed)) setStickies(parsed);
      }
    } catch {
      setStickies([]);
    }
  };

  const saveToStorage = (type, data) => {
    try {
      const key = type === 'todos' ? STORAGE_KEYS.todos : STORAGE_KEYS.stickies;
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
    }
  };

  const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const addTodo = (e) => {
    e.preventDefault();
    if (!todoInput.trim()) return;

    const newTodo = {
      id: generateId(),
      text: todoInput.trim(),
      done: false,
      createdAt: Date.now(),
      sessionId,
      completedAt: null,
      completedSessionId: null
    };

    setTodos((current) => [...current, newTodo]);
    setTodoInput('');
  };

  const toggleTodo = (id) => {
    setTodos((current) =>
      current.map((todo) => {
        if (todo.id !== id) return todo;
        const nextDone = !todo.done;
        return {
          ...todo,
          done: nextDone,
          completedAt: nextDone ? Date.now() : null,
          completedSessionId: nextDone ? sessionId : null
        };
      })
    );
  };

  const deleteTodo = (id) => {
    setTodos((current) => current.filter((todo) => todo.id !== id));
  };

  const clearCompleted = () => {
    setTodos((current) => current.filter((todo) => !todo.done));
  };

  const deleteSticky = (id) => {
    setStickies((current) => current.filter((sticky) => sticky.id !== id));
    if (draftStickyId === id) {
      setDraftStickyId(null);
      setStickyBody('');
      notifiedDraftRef.current = false;
    }
  };

  const startNewDraft = () => {
    if (!stickyBody.trim()) {
      setDraftStickyId(null);
      notifiedDraftRef.current = false;
    }
  };

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-8">
      <div className="stack-lg">
        <SectionHeader
          eyebrow={activeTab === 'sticky' ? 'Quick notes' : 'Tasks'}
          title={activeTab === 'sticky' ? 'Quick Notes' : 'Tasks'}
          subtitle={activeTab === 'sticky' ? 'Keep short notes in one place.' : 'Capture the next thing you need to do.'}
        />

        {!hideToggle ? (
          <div className="segmented">
            <Button variant="ghost" size="sm" className={activeTab === 'todo' ? 'is-selected' : ''} onClick={() => setActiveTab('todo')}>
              Tasks
            </Button>
            <Button variant="ghost" size="sm" className={activeTab === 'sticky' ? 'is-selected' : ''} onClick={() => setActiveTab('sticky')}>
              Quick notes
            </Button>
          </div>
        ) : null}

        {activeTab === 'todo' ? (
          <div className="space-y-5">
            <form onSubmit={addTodo}>
              <input
                className="h-12 w-full rounded-[14px] border border-white/6 bg-[rgba(12,11,17,0.72)] px-4 text-[15px] text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                type="text"
                value={todoInput}
                onChange={(e) => setTodoInput(e.target.value)}
                placeholder="Add a task and press Enter"
              />
            </form>

            <div className="border-t border-white/6 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-[14px] font-medium text-[rgba(245,242,238,0.78)]">Task list</p>
                {completedCount > 0 ? (
                  <button
                    type="button"
                    onClick={clearCompleted}
                    className="text-[13px] font-medium text-[rgba(245,242,238,0.54)] transition hover:text-[#F5F2EE]"
                  >
                    Clear completed
                  </button>
                ) : null}
              </div>

              {todos.length === 0 ? (
                <div className="space-y-1 py-2">
                  <p className="text-[14px] font-medium text-[#F5F2EE]">No tasks yet</p>
                  <p className="text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Add one above to keep track of your next step.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex min-h-[56px] items-center justify-between rounded-[14px] border border-white/5 bg-white/3 px-4 py-3 transition hover:bg-white/5"
                    >
                      <label className="flex min-w-0 flex-1 items-center gap-3">
                        <input
                          type="checkbox"
                          checked={todo.done}
                          onChange={() => toggleTodo(todo.id)}
                          className="mt-[1px] h-4 w-4 shrink-0 accent-orange-400"
                        />
                        <span className={`break-words text-[14px] font-medium leading-6 ${todo.done ? 'text-white/38 line-through' : 'text-[#F5F2EE]'}`}>
                          {todo.text}
                        </span>
                      </label>
                      <div className="ml-4 flex shrink-0 items-center gap-4">
                        <span className="text-[12px] font-medium text-[rgba(245,242,238,0.38)]">
                          {new Date(todo.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </span>
                        <button
                          type="button"
                          onClick={() => deleteTodo(todo.id)}
                          className="text-[12px] font-medium text-[rgba(245,242,238,0.42)] transition hover:text-[#F5F2EE]"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <textarea
              className="min-h-[180px] w-full rounded-[16px] border border-white/6 bg-[rgba(12,11,17,0.75)] p-4 text-[15px] leading-[1.6] text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
              value={stickyBody}
              onChange={(e) => setStickyBody(e.target.value)}
              onBlur={startNewDraft}
              placeholder="Write a quick note. It saves automatically."
            />

            <div className="border-t border-white/6 pt-4">
              <p className="mb-3 text-[14px] font-medium text-[rgba(245,242,238,0.78)]">Saved notes</p>
              {stickies.length === 0 ? (
                <div className="space-y-1 py-2">
                  <p className="text-[14px] font-medium text-[#F5F2EE]">No notes yet</p>
                  <p className="text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Start typing above and your note will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {stickies.map((sticky) => (
                    <article key={sticky.id} className="rounded-[14px] border border-white/5 bg-white/3 p-[14px]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="line-clamp-3 whitespace-pre-wrap text-[14px] leading-[1.6] text-[#F5F2EE]">{sticky.body}</p>
                          <p className="mt-2 text-[12px] font-medium text-[rgba(245,242,238,0.42)]">
                            {new Date(sticky.updatedAt || sticky.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteSticky(sticky.id)}
                          className="shrink-0 text-[12px] font-medium text-[rgba(245,242,238,0.42)] transition hover:text-[#F5F2EE]"
                        >
                          Delete
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default TodoSticky;

