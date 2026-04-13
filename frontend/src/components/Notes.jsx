import { useEffect, useState } from 'react';
import { InlineAlert, SectionHeader } from './ui';

const API_URL = 'http://localhost:3000';

function Notes({ sessionId, selectedSession, onNotify }) {
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState('');
  const [timestampSec, setTimestampSec] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isActiveSession = selectedSession?.status === 'active';

  const fetchNotes = async () => {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}/notes`);
      if (!response.ok) throw new Error('Failed to fetch notes');
      const data = await response.json();
      setNotes(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) {
      setError('Note text cannot be empty');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/sessions/${sessionId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: noteText.trim(),
          timestampSec: Number(timestampSec) || 0
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add note');
      }

      const addedNote = await response.json();
      setNotes((current) => [...current, addedNote].sort((a, b) => a.timestampSec - b.timestampSec));
      setNoteText('');
      setTimestampSec(0);
      onNotify?.('Note saved', 'Your timestamp note has been added.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteNote = async (noteId) => {
    try {
      const response = await fetch(`${API_URL}/sessions/${sessionId}/notes/${noteId}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete note');
      setNotes((current) => current.filter((note) => note.id !== noteId));
      onNotify?.('Note deleted', 'The note was removed from this session.');
    } catch (err) {
      setError(err.message);
    }
  };

  const formatTimestamp = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    fetchNotes();
  }, [sessionId]);

  return (
    <div className="mx-auto w-full max-w-[980px] px-6 py-8">
      <div className="stack-lg">
        <SectionHeader eyebrow="Timestamp notes" title="Timestamp Notes" subtitle={null} />

        {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

        {!isActiveSession ? (
          <div className="space-y-1">
            <p className="text-[14px] font-medium text-[#F5F2EE]">Start session to capture notes</p>
            <p className="text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Timestamp entry becomes available during a live session.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">During session</p>
            <div className="flex h-11 gap-[10px]">
              <input
                className="w-[96px] rounded-[12px] border border-white/6 bg-[rgba(12,11,17,0.75)] px-3 text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                type="number"
                min="0"
                value={timestampSec}
                onChange={(e) => setTimestampSec(e.target.value)}
                placeholder="0"
              />
              <input
                className="flex-1 rounded-[12px] border border-white/6 bg-[rgba(12,11,17,0.75)] px-3 text-[#F5F2EE] outline-none placeholder:text-[rgba(245,242,238,0.34)] focus:border-[rgba(255,138,61,0.55)] focus:shadow-[0_0_0_4px_rgba(255,138,61,0.10)]"
                type="text"
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addNote();
                  }
                }}
                placeholder="Write note..."
              />
              <button
                type="button"
                onClick={addNote}
                disabled={loading}
                className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full bg-[linear-gradient(135deg,#FF8A3D_0%,#FF5C7A_100%)] text-lg font-semibold text-white shadow-[0_12px_28px_rgba(255,108,76,0.24)] disabled:opacity-50"
              >
                +
              </button>
            </div>
          </div>
        )}

        <div className="border-t border-white/6 pt-4">
          {notes.length === 0 ? (
            <div className="space-y-1">
              <p className="text-[14px] font-medium text-[#F5F2EE]">No timestamp notes yet</p>
              <p className="text-[13px] font-medium text-[rgba(245,242,238,0.42)]">Notes captured during a session will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map((note) => (
                <div key={note.id} className="flex items-center justify-between rounded-[12px] px-3 py-2 transition hover:bg-white/4">
                  <div className="min-w-0">
                    <p className="text-[14px] font-medium text-[#F5F2EE]">
                      <span className="mr-3 text-[rgba(255,138,61,0.88)]">[{formatTimestamp(note.timestampSec)}]</span>
                      {note.text}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteNote(note.id)}
                    className="ml-4 shrink-0 text-[12px] font-medium text-[rgba(245,242,238,0.42)] transition hover:text-[#F5F2EE]"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Notes;
