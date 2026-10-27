// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { AppSettings, DEFAULT_SETTINGS, FileItem, ResolvedFile } from '../../types';
import { act, renderHook } from '../../test/renderHook';
import { useQueue } from '../useQueue';

vi.mock('../../api/client', () => ({
  apiClient: { resolvePaths: vi.fn(), convertFile: vi.fn(), saveMarkdown: vi.fn(), openFolder: vi.fn() }
}));
vi.mock('../../utils/desktop', () => ({ IS_DESKTOP: false, pickMarkdownTarget: vi.fn() }));

const api = vi.mocked(apiClient);

const resolved = (name: string): ResolvedFile => ({ name, path: `/docs/${name}`, size: 10, extension: '.txt' });

const converted = (markdown = '# Titel', extra: object = {}) => ({
  success: true,
  markdown,
  title: 'Titel',
  word_count: 1,
  char_count: markdown.length,
  line_count: 1,
  duration_ms: 5,
  target_path: null,
  saved: false,
  ...extra
});

const failed = { success: false, error: 'kaputt', error_details: 'trace', solution_hint: 'tipp', duration_ms: 1 };

function setup(settings: Partial<AppSettings> = {}) {
  const notify = vi.fn();
  const onHistoryChanged = vi.fn();
  const onShowResult = vi.fn();
  const settingsRef = { current: { ...DEFAULT_SETTINGS, ...settings } };
  const { result } = renderHook(() => useQueue({ settingsRef, notify, onHistoryChanged, onShowResult }));
  return { result, notify, onHistoryChanged, onShowResult, settingsRef };
}

type Queue = ReturnType<typeof setup>['result'];

async function addFiles(result: Queue, ...names: string[]) {
  api.resolvePaths.mockResolvedValueOnce({ files: names.map(resolved), skipped: 0, truncated: false });
  await act(async () => {
    await result.current.addPaths(names.map((n) => `/docs/${n}`));
  });
}

const byName = (result: Queue, name: string): FileItem => result.current.files.find((f) => f.name === name)!;

beforeEach(() => {
  vi.resetAllMocks();
  api.openFolder.mockResolvedValue({});
});

afterEach(() => vi.useRealTimers());

describe('adding files', () => {
  it('lists resolved files as ready and skips ones already in the list', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt', 'b.txt');
    await addFiles(result, 'b.txt', 'c.txt');
    expect(result.current.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(result.current.files.every((f) => f.status === 'ready')).toBe(true);
  });

  it('says so when nothing usable was found', async () => {
    const { result, notify } = setup();
    api.resolvePaths.mockResolvedValueOnce({ files: [], skipped: 2, truncated: false });
    await act(async () => {
      await result.current.addPaths(['/docs']);
    });
    expect(notify).toHaveBeenCalledWith('Keine unterstützten Dateien gefunden', 'info');
  });

  it('reports skipped and truncated results', async () => {
    const { result, notify } = setup();
    api.resolvePaths.mockResolvedValueOnce({ files: [resolved('a.txt')], skipped: 3, truncated: false });
    await act(async () => {
      await result.current.addPaths(['x']);
    });
    expect(notify).toHaveBeenLastCalledWith('1 Dateien hinzugefügt, 3 übersprungen', 'info');
    api.resolvePaths.mockResolvedValueOnce({ files: [resolved('b.txt')], skipped: 0, truncated: true });
    await act(async () => {
      await result.current.addPaths(['y']);
    });
    expect(notify).toHaveBeenLastCalledWith('Nur die ersten 1 Dateien wurden übernommen', 'info');
  });

  it('shows an error instead of throwing when the backend cannot read the paths', async () => {
    const { result, notify } = setup();
    api.resolvePaths.mockRejectedValueOnce(new Error('HTTP 500'));
    await act(async () => {
      await result.current.addPaths(['/x']);
    });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('HTTP 500'), 'error');
    expect(result.current.files).toEqual([]);
  });
});

describe('converting', () => {
  it('stores the result and passes the settings to the backend', async () => {
    const { result, onHistoryChanged, onShowResult } = setup({
      default_output_dir: '/out',
      collision_strategy: 'skip',
      keep_data_uris: true
    });
    await addFiles(result, 'a.txt');
    api.convertFile.mockResolvedValueOnce(converted('# Hallo'));
    await act(async () => {
      await result.current.convertSingle(result.current.files[0].id);
    });
    const file = byName(result, 'a.txt');
    expect(file).toMatchObject({ status: 'success', markdownContent: '# Hallo', wordCount: 1, saved: false });
    expect(api.convertFile.mock.calls[0][0]).toMatchObject({
      source_path: '/docs/a.txt',
      target_dir: '/out',
      collision_strategy: 'skip',
      keep_data_uris: true,
      save: false
    });
    expect(onHistoryChanged).toHaveBeenCalled();
    expect(onShowResult).toHaveBeenCalledWith(expect.objectContaining({ name: 'a.txt' }));
  });

  it('marks a file as saved when the backend saved it right away', async () => {
    const { result } = setup({ auto_save_after_convert: true });
    await addFiles(result, 'a.txt');
    api.convertFile.mockResolvedValueOnce(converted('x', { saved: true, target_path: '/docs/a.md' }));
    await act(async () => {
      await result.current.convertAll();
    });
    expect(byName(result, 'a.txt')).toMatchObject({ saved: true, targetPath: '/docs/a.md' });
    expect(api.convertFile.mock.calls[0][0]).toMatchObject({ save: true });
  });

  it('keeps the error details of a failed conversion and goes on with the others', async () => {
    const { result, notify } = setup();
    await addFiles(result, 'a.txt', 'b.txt');
    api.convertFile.mockImplementation(async (params) => (params.file_name === 'a.txt' ? failed : converted()));
    await act(async () => {
      await result.current.convertAll();
    });
    expect(byName(result, 'a.txt')).toMatchObject({
      status: 'failed',
      error: 'kaputt',
      errorDetails: 'trace',
      solutionHint: 'tipp'
    });
    expect(byName(result, 'b.txt').status).toBe('success');
    expect(notify).toHaveBeenLastCalledWith('1 umgewandelt, 1 mit Fehler', 'error');
  });

  it('reports an unreachable backend per file', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt');
    api.convertFile.mockRejectedValueOnce(new Error('Failed to fetch'));
    await act(async () => {
      await result.current.convertAll();
    });
    expect(byName(result, 'a.txt').error).toBe('Backend nicht erreichbar (Failed to fetch)');
  });

  it('never runs more files at once than the concurrency limit', async () => {
    const { result } = setup({ concurrency_limit: 2 });
    await addFiles(result, 'a.txt', 'b.txt', 'c.txt', 'd.txt', 'e.txt');
    let running = 0;
    let peak = 0;
    api.convertFile.mockImplementation(async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 10));
      running--;
      return converted();
    });
    await act(async () => {
      await result.current.convertAll();
    });
    expect(peak).toBe(2);
    expect(api.convertFile).toHaveBeenCalledTimes(5);
    expect(result.current.files.every((f) => f.status === 'success')).toBe(true);
  });

  it('does not start a second batch while one is running', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt', 'b.txt');
    api.convertFile.mockImplementation(async () => converted());
    await act(async () => {
      await Promise.all([result.current.convertAll(), result.current.convertAll()]);
    });
    expect(api.convertFile).toHaveBeenCalledTimes(2);
  });

  it('retries files that failed earlier when converting all again', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt', 'b.txt');
    api.convertFile.mockResolvedValueOnce(converted()).mockResolvedValueOnce(failed);
    await act(async () => {
      await result.current.convertAll();
    });
    api.convertFile.mockResolvedValueOnce(converted());
    await act(async () => {
      await result.current.convertAll();
    });
    expect(api.convertFile).toHaveBeenCalledTimes(3);
    expect(result.current.files.every((f) => f.status === 'success')).toBe(true);
  });

  it('gives up on a backend that stops answering, a little after the time limit', async () => {
    vi.useFakeTimers();
    const { result } = setup({ timeout_seconds: 1 });
    await addFiles(result, 'a.txt');
    api.convertFile.mockImplementation(
      (_params, signal) =>
        new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    let done: Promise<void> = Promise.resolve();
    await act(async () => {
      done = result.current.convertSingle(result.current.files[0].id);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_500);
    });
    expect(byName(result, 'a.txt').status).toBe('converting');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
      await done;
    });
    expect(byName(result, 'a.txt')).toMatchObject({ status: 'failed', error: 'Zeitüberschreitung nach 1 s' });
  });
});

async function withResult() {
  const ctx = setup();
  await addFiles(ctx.result, 'a.txt');
  api.convertFile.mockResolvedValueOnce(converted('# Hallo'));
  await act(async () => {
    await ctx.result.current.convertAll();
  });
  return ctx;
}

describe('saving', () => {
  it('writes the preview next to the original and remembers where', async () => {
    const { result, onHistoryChanged } = await withResult();
    api.saveMarkdown.mockResolvedValueOnce({ success: true, target_path: '/docs/a.md', saved: true, skipped: false });
    let saved: FileItem | null = null;
    await act(async () => {
      saved = await result.current.save(result.current.files[0].id);
    });
    expect(saved).toMatchObject({ saved: true, targetPath: '/docs/a.md' });
    expect(byName(result, 'a.txt')).toMatchObject({ saved: true, targetPath: '/docs/a.md' });
    expect(api.saveMarkdown.mock.calls[0][0]).toMatchObject({
      content: '# Hallo',
      source_path: '/docs/a.txt',
      file_name: 'a.txt',
      filename_template: '{name}.md'
    });
    expect(onHistoryChanged).toHaveBeenCalled();
  });

  it('saves edited content instead of the converted text', async () => {
    const { result } = await withResult();
    api.saveMarkdown.mockResolvedValueOnce({ success: true, target_path: '/docs/a.md', saved: true, skipped: false });
    await act(async () => {
      await result.current.save(result.current.files[0].id, { content: '# Bearbeitet' });
    });
    expect(api.saveMarkdown.mock.calls[0][0].content).toBe('# Bearbeitet');
    expect(byName(result, 'a.txt').markdownContent).toBe('# Bearbeitet');
  });

  it('leaves the file unsaved when the existing file is skipped', async () => {
    const { result, notify } = await withResult();
    api.saveMarkdown.mockResolvedValueOnce({ success: true, target_path: '/docs/a.md', saved: false, skipped: true });
    let saved: FileItem | null = null;
    await act(async () => {
      saved = await result.current.save(result.current.files[0].id);
    });
    expect(saved).toBeNull();
    expect(byName(result, 'a.txt').saved).toBe(false);
    expect(notify).toHaveBeenCalledWith('a.txt: Datei existiert bereits, übersprungen', 'info');
  });

  it('tells the user when saving fails and keeps the result', async () => {
    const { result, notify } = await withResult();
    api.saveMarkdown.mockRejectedValueOnce(new Error('Zielordner fehlt'));
    await act(async () => {
      await result.current.save(result.current.files[0].id);
    });
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('Zielordner fehlt'), 'error');
    expect(byName(result, 'a.txt')).toMatchObject({ saved: false, markdownContent: '# Hallo' });
  });

  it('does not save a file that was never converted', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt');
    let saved: FileItem | null = null;
    await act(async () => {
      saved = await result.current.save(result.current.files[0].id);
    });
    expect(saved).toBeNull();
    expect(api.saveMarkdown).not.toHaveBeenCalled();
  });

  it('save all only writes results that are not on disk yet', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt', 'b.txt', 'c.txt');
    api.convertFile.mockImplementation(async (params) =>
      params.file_name === 'c.txt' ? failed : converted('x', params.file_name === 'b.txt' ? { saved: true, target_path: '/docs/b.md' } : {})
    );
    await act(async () => {
      await result.current.convertAll();
    });
    api.saveMarkdown.mockResolvedValue({ success: true, target_path: '/docs/a.md', saved: true, skipped: false });
    let count = 0;
    await act(async () => {
      count = await result.current.saveAll();
    });
    expect(count).toBe(1);
    expect(api.saveMarkdown).toHaveBeenCalledTimes(1);
    expect(api.saveMarkdown.mock.calls[0][0].file_name).toBe('a.txt');
  });
});

describe('editing the list', () => {
  it('removes one file or clears everything', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt', 'b.txt');
    act(() => result.current.remove(result.current.files[0].id));
    expect(result.current.files.map((f) => f.name)).toEqual(['b.txt']);
    act(() => result.current.clear());
    expect(result.current.files).toEqual([]);
  });

  it('updateContent keeps the edit and whether it is on disk', async () => {
    const { result } = setup();
    await addFiles(result, 'a.txt');
    act(() => result.current.updateContent(result.current.files[0].id, '# Neu', true));
    expect(byName(result, 'a.txt')).toMatchObject({ markdownContent: '# Neu', saved: true });
  });
});
