export function SensorCard({
  label, icon, value, unit, color,
}: { label: string; icon: React.ReactNode; value: number | null | undefined; unit: string; color: string }) {
  return (
    <div className="p-3 rounded-2xl bg-bg-soft text-center">
      <div className="mb-1 flex justify-center">{icon}</div>
      <div className="text-xl font-extrabold" style={{ color }}>
        {value != null ? value : "--"}
      </div>
      <div className="text-[10px] text-txt2">{unit}</div>
      <div className="text-[10px] text-txt3 mt-0.5">{label}</div>
    </div>
  );
}

export function ControlButton({
  label, icon, on, onClick, disabled,
}: { label: string; icon: React.ReactNode; on: boolean; onClick: () => void; disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-2xl border-2 transition disabled:opacity-50 flex items-center gap-2 ${
        on ? "bg-g1 border-g1 text-white" : "bg-bg-card border-brd text-txt2"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <div className="flex-1 text-left">
        <div className="text-xs font-bold">{label}</div>
        <div className="text-[10px] opacity-80">{on ? "ON" : "OFF"}</div>
      </div>
    </button>
  );
}
