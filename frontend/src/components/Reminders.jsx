import { useEffect, useState } from 'react';
import { Button, InlineAlert } from './ui';

const STORAGE_KEY = 'studycomp_reminders_v1';

function Reminders({ onNotify }) {
  const [reminders, setReminders] = useState([]);
  const [titleInput, setTitleInput] = useState('');
  const [datetimeInput, setDatetimeInput] = useState('');
  const [repeatInput, setRepeatInput] = useState('none');
  const [formError, setFormError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    const sync = () => {
      loadFromStorage();
    };

    window.addEventListener('storage', sync);
    window.addEventListener('studycomp:reminders-updated', sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('studycomp:reminders-updated', sync);
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    saveToStorage(reminders);
  }, [loaded, reminders]);

  const loadFromStorage = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          setReminders(parsed.sort((a, b) => a.dueAt - b.dueAt));
        } else {
          setReminders([]);
        }
      } else {
        setReminders([]);
      }
    } catch {
      setReminders([]);
    } finally {
      setLoaded(true);
    }
  };

  const saveToStorage = (data) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      window.dispatchEvent(new Event('studycomp:reminders-updated'));
    } catch {
    }
  };

  const generateId = () => `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const addReminder = (e) => {
    e.preventDefault();
    setFormError('');

    if (!titleInput.trim()) {
      setFormError('Please enter a reminder title.');
      return;
    }

    if (!datetimeInput) {
      setFormError('Please select a date and time.');
      return;
    }

    const dueAt = new Date(datetimeInput).getTime();
    if (Number.isNaN(dueAt)) {
      setFormError('Invalid date or time.');
      return;
    }

    if (dueAt < Date.now()) {
      setFormError('Cannot create a reminder in the past.');
      return;
    }

    const nextReminder = {
      id: generateId(),
      title: titleInput.trim(),
      dueAt,
      repeat: repeatInput,
      createdAt: Date.now()
    };

    setReminders((current) => [...current, nextReminder].sort((a, b) => a.dueAt - b.dueAt));
    setTitleInput('');
    setDatetimeInput('');
    setRepeatInput('none');
    setFormOpen(false);
    onNotify?.('Reminder added', 'The reminder has been scheduled.');
  };

  const deleteReminder = (id) => {
    setReminders((current) => current.filter((reminder) => reminder.id !== id));
  };

  return (
    <div className="mx-auto min-h-full w-full max-w-[980px] px-6 py-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-[rgba(245,242,238,0.45)]">Reminders</p>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-[28px] font-bold text-[#F5F2EE]">Keep track of what comes next</h2>
              <p className="mt-2 text-[14px] font-medium text-[rgba(245,242,238,0.56)]">
                Add time-based reminders and review everything scheduled for later.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setFormOpen((current) => !current)}
              className="inline-flex h-11 items-center rounded-[14px] border border-white/6 bg-white/4 px-4 text-[14px] font-semibold text-[#F5F2EE] transition hover:bg-white/7"
            >
              {formOpen ? 'Close form' : '+ Add reminder'}
            </button>
          </div>
        </div>

        {formOpen ? (
          <form
            className="space-y-4 rounded-[20px] border border-white/6 bg-[rgba(255,255,255,0.03)] p-5"
            onSubmit={addReminder}
          >
            <div className="space-y-1">
              <p className="text-[14px] font-semibold text-[#F5F2EE]">New reminder</p>
              <p className="text-[13px] font-medium text-[rgba(245,242,238,0.48)]">
                Choose a title, date, and repeat option.
              </p>
            </div>

            <input
              className="h-11 w-full rounded-[14px] border border-white/6 bg-[rgba(12,11,17,0.72)] px-4 text-[15px] text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
              type="text"
              value={titleInput}
              onChange={(e) => {
                setTitleInput(e.target.value);
                if (formError) setFormError('');
              }}
              placeholder="What reminder?"
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className="h-11 rounded-[14px] border border-white/6 bg-[rgba(12,11,17,0.72)] px-4 text-[15px] text-[#F5F2EE] outline-none focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                type="datetime-local"
                value={datetimeInput}
                style={{ colorScheme: 'dark' }}
                onChange={(e) => {
                  setDatetimeInput(e.target.value);
                  if (formError) setFormError('');
                }}
              />
              <select
                className="h-11 rounded-[14px] border border-white/6 bg-[rgba(12,11,17,0.72)] px-4 text-[15px] text-[#F5F2EE] outline-none focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                value={repeatInput}
                onChange={(e) => {
                  setRepeatInput(e.target.value);
                  if (formError) setFormError('');
                }}
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            {formError ? <InlineAlert tone="warning">{formError}</InlineAlert> : null}

            <Button
              type="submit"
              variant="primary"
              className="h-11 rounded-[14px] border-none bg-[linear-gradient(135deg,#FF8A3D_0%,#FF5C7A_100%)] px-5 font-semibold text-white shadow-[0_12px_28px_rgba(255,108,76,0.24)]"
            >
              Save reminder
            </Button>
          </form>
        ) : null}

        <div className="space-y-3 rounded-[20px] border border-white/6 bg-[rgba(255,255,255,0.03)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[15px] font-semibold text-[#F5F2EE]">Upcoming</p>
              <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.48)]">
                {reminders.length ? `${reminders.length} reminder${reminders.length === 1 ? '' : 's'} scheduled` : 'Nothing scheduled yet'}
              </p>
            </div>
          </div>

          {!loaded ? (
            <p className="text-[14px] font-medium text-[rgba(245,242,238,0.62)]">Loading reminders...</p>
          ) : reminders.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-white/10 bg-[rgba(12,11,17,0.35)] p-4">
              <p className="text-[14px] font-medium text-[#F5F2EE]">No reminders yet</p>
              <p className="mt-1 text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Add one when you need it.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {reminders.map((reminder) => (
                <article key={reminder.id} className="rounded-[16px] border border-white/5 bg-[rgba(12,11,17,0.36)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[rgba(245,242,238,0.54)]">
                        {new Date(reminder.dueAt).toLocaleString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit'
                        })}
                      </p>
                      <p className="mt-1 text-[15px] font-medium text-[#F5F2EE]">{reminder.title}</p>
                      <p className="mt-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-[rgba(255,138,61,0.78)]">
                        {reminder.repeat === 'none' ? 'One time' : `Repeats ${reminder.repeat}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteReminder(reminder.id)}
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
    </div>
  );
}

export default Reminders;

