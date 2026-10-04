"use client";

import { useEffect, useRef, useState } from "react";

export default function MultiSelectCell({
  values,
  options,
  onChange,
}: {
  values: string[];
  options: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [open]);

  const toggle = (opt: string) => {
    const next = values.includes(opt) ? values.filter((v) => v !== opt) : [...values, opt];
    onChange(next);
  };

  return (
    <div className="multiselect-dropdown" ref={ref}>
      <button
        type="button"
        className="multiselect-btn text-gray-700 dark:text-gray-300"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {values.length === 0 ? <span className="text-gray-400 italic">Select...</span> : values.join(", ")}
      </button>
      {open && (
        <div className="multiselect-menu show" onClick={(e) => e.stopPropagation()}>
          {options.length === 0 ? (
            <div className="px-3 py-2 text-xs text-gray-500 italic">No options</div>
          ) : (
            options.map((opt) => (
              <label
                key={opt}
                className="flex items-center px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer text-xs"
              >
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={values.includes(opt)}
                  onChange={() => toggle(opt)}
                />
                {opt}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
