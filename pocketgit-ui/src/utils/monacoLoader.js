let monacoPromise;

export function loadMonaco() {
  if (!monacoPromise) {
    monacoPromise = Promise.all([
      import('monaco-editor/esm/vs/editor/editor.api'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/json/json.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('monaco-editor/esm/vs/language/html/html.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker')
    ]).then(([monaco, EditorWorker, JsonWorker, CssWorker, HtmlWorker, TsWorker]) => {
      const EditorWorkerClass = EditorWorker.default || EditorWorker;
      const JsonWorkerClass = JsonWorker.default || JsonWorker;
      const CssWorkerClass = CssWorker.default || CssWorker;
      const HtmlWorkerClass = HtmlWorker.default || HtmlWorker;
      const TsWorkerClass = TsWorker.default || TsWorker;
      const globalObj = typeof self === 'undefined' ? window : self;
      globalObj.MonacoEnvironment = {
        getWorker(_moduleId, label) {
          if (label === 'json') return new JsonWorkerClass();
          if (label === 'css' || label === 'scss' || label === 'less') return new CssWorkerClass();
          if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorkerClass();
          if (label === 'typescript' || label === 'javascript') return new TsWorkerClass();
          return new EditorWorkerClass();
        }
      };
      return monaco;
    });
  }
  return monacoPromise;
}
