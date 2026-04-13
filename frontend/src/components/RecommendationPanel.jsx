import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, InlineAlert } from './ui';

const API_URL = 'http://localhost:3000';

const QUESTIONS = [
  {
    key: 'level',
    prompt: 'What is your current level with this topic?',
    options: [
      { label: 'Beginner', value: 'BEGINNER' },
      { label: 'Intermediate', value: 'INTERMEDIATE' },
      { label: 'Advanced', value: 'ADVANCED' }
    ],
    required: true
  },
  {
    key: 'goal',
    prompt: 'What do you want from the video most?',
    options: [
      { label: 'Learn basics', value: 'Learn the fundamentals clearly' },
      { label: 'Build something', value: 'Build a small practical project' },
      { label: 'Understand concepts', value: 'Get concept clarity, not just code' }
    ],
    required: true
  },
  {
    key: 'preferredStyle',
    prompt: 'What kind of teaching do you want?',
    options: [
      { label: 'Project-based', value: 'PROJECT-BASED' },
      { label: 'Concept-first', value: 'CONCEPT-FIRST' },
      { label: 'Balanced', value: 'BALANCED' }
    ],
    required: true
  },
  {
    key: 'maxDurationMinutes',
    prompt: 'Do you want a time limit, or any length is fine?',
    options: [
      { label: 'Under 30 min', value: 30 },
      { label: 'Under 1 hour', value: 60 },
      { label: 'Any length', value: null }
    ],
    required: false
  },
  {
    key: 'knownPrerequisites',
    prompt: 'What do you already know?',
    placeholder: 'For example: JavaScript basics, SQL basics, algebra...',
    required: false
  },
  {
    key: 'avoid',
    prompt: 'Anything you want to avoid?',
    placeholder: 'For example: too much theory, outdated content, advanced topics...',
    required: false
  }
];

const INITIAL_PROFILE = {
  rawRequirement: '',
  level: null,
  goal: '',
  preferredStyle: '',
  maxDurationMinutes: undefined,
  knownPrerequisites: '',
  avoid: ''
};

const REFINE_SECTIONS = [
  'level',
  'goal',
  'preferredStyle',
  'maxDurationMinutes'
];

function formatDuration(durationSeconds) {
  if (!durationSeconds) return null;
  const minutes = Math.round(durationSeconds / 60);
  return `${minutes} min`;
}

function RecommendationCard({ result }) {
  return (
    <article className="rounded-[22px] border border-white/6 bg-white/4 p-5">
      <div className="flex gap-4">
        {result.thumbnailUrl ? (
          <img
            src={result.thumbnailUrl}
            alt={result.title}
            className="h-28 w-44 rounded-[16px] object-cover"
          />
        ) : null}

        <div className="min-w-0 flex-1">
          <div>
            <h3 className="text-lg font-semibold text-[#F5F2EE]">{result.title}</h3>
            <p className="mt-1 text-sm text-[rgba(245,242,238,0.56)]">{result.channelTitle || 'Unknown channel'}</p>
          </div>

          <p className="mt-3 text-sm leading-6 text-[rgba(245,242,238,0.72)]">{result.summary}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              result.dominantDifficulty,
              result.attributes?.language,
              result.attributes?.teachingStyle,
              formatDuration(result.durationSeconds),
              result.attributes?.analysisMode === 'transcript' ? 'Transcript used' : 'Metadata based'
            ]
              .filter(Boolean)
              .map((label) => (
                <span
                  key={label}
                  className="rounded-full border border-white/8 bg-white/5 px-3 py-1 text-xs font-medium text-white/72"
                >
                  {label}
                </span>
              ))}
          </div>

          {result.conceptsCovered?.length ? (
            <p className="mt-4 text-sm text-[rgba(245,242,238,0.64)]">
              Covers: {result.conceptsCovered.slice(0, 6).join(', ')}
            </p>
          ) : null}

          {result.whyMatched?.length ? (
            <ul className="mt-4 space-y-2 text-sm text-[rgba(245,242,238,0.7)]">
              {result.whyMatched.map((reason) => (
                <li key={reason}>- {reason}</li>
              ))}
            </ul>
          ) : null}

          {result.warnings?.length ? (
            <ul className="mt-3 space-y-2 text-sm text-[#FFB787]">
              {result.warnings.map((warning) => (
                <li key={warning}>Note: {warning}</li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5">
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-[42px] items-center rounded-[14px] bg-[linear-gradient(135deg,#FF8A3D_0%,#FF5C7A_100%)] px-4 text-sm font-semibold text-white"
            >
              Open on YouTube
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}

function QuickReplyChips({ options, selectedValue, onSelect }) {
  if (!options?.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => {
        const isSelected = selectedValue === option.value || (selectedValue == null && option.value == null);
        return (
          <button
            key={option.label}
            type="button"
            onClick={() => onSelect(option)}
            className={`rounded-full border px-4 py-2 text-sm transition ${
              isSelected
                ? 'border-[#FF8A3D]/60 bg-[rgba(255,138,61,0.18)] text-white'
                : 'border-white/8 bg-white/6 text-white/82 hover:bg-white/10'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function getQuestionByKey(key) {
  return QUESTIONS.find((question) => question.key === key) || null;
}

function RecommendationPanel() {
  const [profile, setProfile] = useState(INITIAL_PROFILE);
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      text: 'Enter a topic, skill, or project to find relevant study videos.'
    }
  ]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [meta, setMeta] = useState(null);
  const [searched, setSearched] = useState(false);
  const [showRefinements, setShowRefinements] = useState(false);
  const [hasPendingRefinements, setHasPendingRefinements] = useState(false);
  const nextIdRef = useRef(2);
  const refineQuestions = useMemo(
    () => REFINE_SECTIONS.map((key) => getQuestionByKey(key)).filter(Boolean),
    []
  );

  function appendMessage(role, text) {
    setMessages((current) => [...current, { id: nextIdRef.current++, role, text }]);
  }

  async function runRecommendations(nextProfile, assistantMessage = null) {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_URL}/recommendations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawRequirement: nextProfile.rawRequirement,
          level: nextProfile.level,
          goal: nextProfile.goal,
          preferredStyle: nextProfile.preferredStyle,
          maxDurationMinutes: nextProfile.maxDurationMinutes ?? null,
          knownPrerequisites: nextProfile.knownPrerequisites,
          avoid: nextProfile.avoid
        })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to fetch recommendations');
      }

      setResults(payload.results || []);
      setMeta({
        userProfile: payload.userProfile || null
      });

      appendMessage(
        'assistant',
        assistantMessage ||
          ((payload.results || []).length
            ? 'Recommended videos are ready.'
            : 'No strong matches yet. Narrow the topic or use filters to refine the search.')
      );
    } catch (fetchError) {
      setError(fetchError.message);
      appendMessage('assistant', 'Search could not be completed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  function updateProfileField(key, value) {
    setProfile((current) => ({ ...current, [key]: value }));
    if (searched) {
      setHasPendingRefinements(true);
    }
  }

  function handleQuickReply(questionKey, option) {
    updateProfileField(questionKey, option.value);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const rawRequirement = draft.trim();
    if (!rawRequirement) return;

    const nextProfile = { ...profile, rawRequirement };
    setProfile(nextProfile);
    setSearched(true);
    appendMessage('user', rawRequirement);
    runRecommendations(nextProfile);
    setDraft('');
  }

  function rerunWithRefinements() {
    if (!profile.rawRequirement.trim()) return;
    setSearched(true);
    setHasPendingRefinements(false);
    runRecommendations(profile, 'Results updated.');
  }

  function restart() {
    setProfile(INITIAL_PROFILE);
    setMessages([
      {
        id: 1,
        role: 'assistant',
        text: 'Enter a topic, skill, or project to find relevant study videos.'
      }
    ]);
    nextIdRef.current = 2;
    setDraft('');
    setLoading(false);
    setError(null);
    setResults([]);
    setMeta(null);
    setSearched(false);
    setShowRefinements(false);
    setHasPendingRefinements(false);
  }

  useEffect(() => {
    if (messages.length === 1 && !searched) {
      setResults([]);
      setMeta(null);
    }
  }, [messages, searched]);

  const statusText = loading
    ? `Searching for "${profile.rawRequirement || draft}".`
    : searched && profile.rawRequirement
      ? `Current search: ${profile.rawRequirement}`
      : 'Enter a topic, skill, or project to find relevant study videos.';

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,242,238,0.45)]">
            Discover
          </p>
          <h2 className="mt-3 text-[30px] font-semibold text-[#F5F2EE]">Find study videos</h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-7 text-[rgba(245,242,238,0.62)]">
            Search by topic, concept, or project. Add filters only when you want narrower results.
          </p>
        </div>

        <Button type="button" variant="ghost" onClick={restart}>
          Start over
        </Button>
      </div>

      <div className="rounded-[24px] border border-white/6 bg-white/4 p-5">
        <div className="rounded-[18px] border border-white/6 bg-[rgba(12,11,17,0.34)] px-4 py-3">
          <p className="text-sm leading-6 text-[rgba(245,242,238,0.78)]">
            {statusText}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-white/76">
              Search
            </span>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              rows={4}
              placeholder="Example: Build a web scraper in Python with Beautiful Soup"
              className="w-full rounded-[14px] border border-white/7 bg-[rgba(12,11,17,0.72)] px-4 py-3 text-white outline-none placeholder:text-white/32"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" variant="primary" busy={loading} disabled={loading || !draft.trim()}>
              Search videos
            </Button>
          </div>
        </form>
      </div>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {searched ? (
        <div className="rounded-[24px] border border-white/6 bg-white/4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-base font-semibold text-[#F5F2EE]">Refine these results</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[rgba(245,242,238,0.62)]">
                Use filters only if the first results are too broad.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowRefinements((current) => !current)}
              >
                {showRefinements ? 'Hide filters' : 'Show filters'}
              </Button>
              {showRefinements ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={rerunWithRefinements}
                  disabled={loading || !profile.rawRequirement.trim() || !hasPendingRefinements}
                >
                  Apply filters
                </Button>
              ) : null}
            </div>
          </div>

          {showRefinements && hasPendingRefinements ? (
            <p className="mt-3 text-sm text-[rgba(245,242,238,0.62)]">
              Filters changed. Select <span className="text-[#F5F2EE]">Apply filters</span> to update the results.
            </p>
          ) : null}

          {showRefinements ? (
            <div className="mt-5 rounded-[20px] border border-white/6 bg-[rgba(12,11,17,0.36)] p-4">
              <div className="grid gap-5 lg:grid-cols-2">
                {refineQuestions.map((question) => (
                  <div key={question.key}>
                    <p className="mb-2 text-sm font-medium text-white/76">{question.prompt}</p>
                    <QuickReplyChips
                      options={question.options || []}
                      selectedValue={profile[question.key]}
                      onSelect={(option) => handleQuickReply(question.key, option)}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/76">What do you already know?</span>
                  <textarea
                    value={profile.knownPrerequisites}
                    onChange={(event) => updateProfileField('knownPrerequisites', event.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className="w-full rounded-[14px] border border-white/7 bg-[rgba(12,11,17,0.72)] px-4 py-3 text-white outline-none placeholder:text-white/32"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-white/76">Anything to avoid?</span>
                  <textarea
                    value={profile.avoid}
                    onChange={(event) => updateProfileField('avoid', event.target.value)}
                    rows={2}
                    placeholder="Optional"
                    className="w-full rounded-[14px] border border-white/7 bg-[rgba(12,11,17,0.72)] px-4 py-3 text-white outline-none placeholder:text-white/32"
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2 text-sm text-[rgba(245,242,238,0.58)]">
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Level</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Goal</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Teaching style</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Length</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Known topics</span>
              <span className="rounded-full border border-white/8 bg-white/5 px-3 py-1">Avoid list</span>
            </div>
          )}
        </div>
      ) : null}

      {meta && !loading && !results.length ? (
        <InlineAlert>
          No strong matches for <strong>{meta.userProfile?.topic || 'this topic'}</strong>. Try a clearer search like "Python basics for beginners" or "React project tutorial."
        </InlineAlert>
      ) : null}

      {results.length ? (
        <div className="space-y-4">
          {results.map((result) => (
            <RecommendationCard key={result.videoId} result={result} />
          ))}
        </div>
      ) : (
        !loading &&
        !meta && (
          <EmptyState
            title="No videos yet"
            copy="Search for a topic, concept, or project to see matching videos here."
          />
        )
      )}
    </div>
  );
}

export default RecommendationPanel;
