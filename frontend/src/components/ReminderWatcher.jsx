import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'studycomp_reminders_v1';
const SETTINGS_STORAGE_KEY = 'studycomp_workspace_settings_v1';

function loadSettings() {
  try {
    const data = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    const parsed = JSON.parse(data || '{}');
    return typeof parsed === 'object' && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function loadReminders() {
  try {
    const data = window.localStorage.getItem(STORAGE_KEY);
    const parsed = JSON.parse(data || '[]');
    return Array.isArray(parsed) ? parsed.sort((a, b) => a.dueAt - b.dueAt) : [];
  } catch {
    return [];
  }
}

function saveReminders(reminders) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
  } catch {
  }
}

function ReminderWatcher({ onNotify }) {
  const [reminders, setReminders] = useState([]);
  const [settings, setSettings] = useState(loadSettings);
  const firedAtMap = useRef({});

  const notifyDueReminder = (reminder) => {
    if (settings.reminderAlert === false) return;

    onNotify?.('Reminder due', reminder.title);

    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        new Notification('Reminder due', {
          body: reminder.title,
          tag: `studycomp-reminder-${reminder.id}`,
          silent: !settings.soundEnabled
        });
      } catch {
      }
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const getNextDueAt = (reminder, now) => {
    if (reminder.repeat === 'none') return reminder.dueAt;

    const increment = reminder.repeat === 'daily' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    let nextDueAt = reminder.dueAt + increment;

    while (nextDueAt <= now) {
      nextDueAt += increment;
    }

    return nextDueAt;
  };

  useEffect(() => {
    const sync = () => {
      setReminders(loadReminders());
      setSettings(loadSettings());
    };

    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('studycomp:reminders-updated', sync);

    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('studycomp:reminders-updated', sync);
    };
  }, []);

  useEffect(() => {
    const checkDueReminders = () => {
      const now = Date.now();
      const dueReminders = reminders
        .filter((reminder) => {
          const firedKey = `${reminder.id}:${reminder.dueAt}`;
          return reminder.dueAt <= now && !firedAtMap.current[firedKey];
        })
        .sort((a, b) => a.dueAt - b.dueAt);

      const nextDue = dueReminders[0] || null;
      if (nextDue) {
        const firedKey = `${nextDue.id}:${nextDue.dueAt}`;
        firedAtMap.current[firedKey] = true;
        notifyDueReminder(nextDue);

        if (nextDue.repeat === 'none') {
          updateReminders(reminders.filter((reminder) => reminder.id !== nextDue.id));
        } else {
          const updated = reminders.map((reminder) =>
            reminder.id === nextDue.id ? { ...reminder, dueAt: getNextDueAt(nextDue, now) } : reminder
          );
          updateReminders(updated);
        }
      }
    };

    checkDueReminders();
    const interval = setInterval(checkDueReminders, 1000);
    return () => clearInterval(interval);
  }, [onNotify, reminders, settings.reminderAlert, settings.soundEnabled]);

  const updateReminders = (nextReminders) => {
    const sorted = [...nextReminders].sort((a, b) => a.dueAt - b.dueAt);
    setReminders(sorted);
    saveReminders(sorted);
    window.dispatchEvent(new Event('studycomp:reminders-updated'));
  };

  return null;
}

export default ReminderWatcher;
