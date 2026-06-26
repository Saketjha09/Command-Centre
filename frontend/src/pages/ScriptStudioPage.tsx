export function ScriptStudioPage() {
  return (
    <div
      className="flex flex-col h-full overflow-y-auto custom-scrollbar"
      style={{ background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
    >
      {/* Page header */}
      <div
        className="px-10 pt-10 pb-8 shrink-0"
        style={{ borderBottom: '1px solid var(--color-border-muted)' }}
      >
        <h1 className="text-2xl font-black tracking-tight" style={{ color: 'var(--color-text-primary)' }}>
          Script Studio
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Generate brand-aligned scripts for your content.
        </p>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        {/* Card */}
        <div
          className="w-full max-w-xl rounded-2xl p-8 flex flex-col gap-6 shadow-sm"
          style={{
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border-default)',
          }}
        >
          {/* Brand select */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Select Brand
            </label>
            <select
              disabled
              className="w-full rounded-xl px-4 py-3 text-[13px] border focus:outline-none cursor-not-allowed opacity-50"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border-default)',
              }}
            >
              <option>Choose a brand...</option>
            </select>
          </div>

          {/* Brief textarea */}
          <div className="flex flex-col gap-2">
            <label
              className="text-[10px] font-bold uppercase tracking-[0.2em]"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Script Brief
            </label>
            <textarea
              disabled
              rows={5}
              placeholder="Describe what you want to create..."
              className="w-full rounded-xl px-4 py-3 text-[13px] border resize-none focus:outline-none cursor-not-allowed opacity-50"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                borderColor: 'var(--color-border-default)',
              }}
            />
          </div>

          {/* Generate button + note */}
          <div className="flex flex-col items-center gap-2 pt-2">
            <button
              disabled
              className="w-full py-3.5 rounded-xl text-[12px] font-bold uppercase tracking-widest cursor-not-allowed opacity-40 transition-all"
              style={{
                background: 'var(--color-accent-secondary)',
                color: 'var(--color-text-primary)',
              }}
            >
              Generate Script
            </button>
            <p className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
              AI generation coming in Phase 4
            </p>
          </div>
        </div>

        {/* Footer note */}
        <p
          className="mt-10 max-w-md text-center text-[12px] leading-relaxed"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Script Studio will use your Brand Vault to generate on-brand scripts using Claude.
          Available soon.
        </p>
      </div>
    </div>
  )
}
