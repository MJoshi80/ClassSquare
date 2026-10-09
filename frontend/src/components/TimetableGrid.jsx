import React, { useState } from 'react';
import { TeacherIcon, RoomIcon, CoffeeIcon } from './Icons';
import TimetableSyncExportMenu from './TimetableSyncExportMenu';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const PERIODS = [1, 2, 3, 4, 5, 6];

const PERIOD_TIMES = {
  1: '09:00 - 10:00',
  2: '10:00 - 11:00',
  3: '11:00 - 12:00',
  4: '12:00 - 13:00',
  5: '14:00 - 15:00',
  6: '15:00 - 16:00',
};

export default function TimetableGrid({
  slots = [],
  onSlotClick,
  readonly = false,
  title,
  subtitle,
  badge,
  syncExportProps,
}) {
  const [selectedSlotKey, setSelectedSlotKey] = useState(null);
  const [allExpanded, setAllExpanded] = useState(false);

  // Map slots into a 2D lookup: matrix[day][period] = slot
  const matrix = {};
  for (let d = 0; d < 5; d++) {
    matrix[d] = {};
  }
  slots.forEach((s) => {
    if (s.day >= 0 && s.day < 5 && s.period >= 1 && s.period <= 6) {
      matrix[s.day][s.period] = s;
    }
  });

  const handleCellClick = (slot, slotKey) => {
    if (allExpanded) {
      setAllExpanded(false);
      setSelectedSlotKey(slotKey);
    } else {
      setSelectedSlotKey((prev) => (prev === slotKey ? null : slotKey));
    }
  };

  const toggleAll = () => {
    if (allExpanded) {
      setAllExpanded(false);
      setSelectedSlotKey(null);
    } else {
      setAllExpanded(true);
      setSelectedSlotKey(null);
    }
  };

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm bg-white animate-fade-in print:overflow-visible print:border-none print:shadow-none print:p-0 print:rounded-none">
      {/* Header Bar with Title, Helper Tip, and Compact/Detailed View Toggle */}
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 bg-slate-50/80 print:hidden">
        <div className="flex items-center gap-2.5 flex-wrap">
          {title && (
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 tracking-tight">{title}</h3>
              {subtitle && <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>}
            </div>
          )}
          {badge}
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-white px-2.5 py-0.5 rounded-full border border-slate-200/90 shadow-2xs">
            💡 Click any class to view faculty & venue
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleAll}
            className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs flex items-center gap-1.5"
            title={allExpanded ? 'Switch to compact view' : 'Show faculty and venue on all classes'}
          >
            {allExpanded ? (
              <>
                <span className="text-slate-500 font-bold text-xs">⊟</span>
                <span>Compact View</span>
              </>
            ) : (
              <>
                <span className="text-blue-600 font-bold text-xs">⊞</span>
                <span>Show All Details</span>
              </>
            )}
          </button>
          {syncExportProps && (
            <div className="flex items-center gap-2">
              <TimetableSyncExportMenu {...syncExportProps} />
            </div>
          )}
        </div>
      </div>

      <table className="min-w-full border-collapse print:w-full print:table-fixed print:border-collapse">
        {/* Table Header with Period Times */}
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200 print:bg-slate-100">
            <th className="w-24 px-3 py-2 text-center font-extrabold uppercase tracking-wider text-[10.5px] text-slate-500 border-r border-slate-200 print:w-[10%] print:px-1 print:py-1 print:text-[8.5px] print:border-slate-300">
              Day / Time
            </th>
            {PERIODS.map((p) => (
              <th
                key={p}
                className="px-2 py-1.5 text-center font-bold text-slate-800 border-r border-slate-200 last:border-r-0 min-w-[135px] print:min-w-0 print:w-[15%] print:px-0.5 print:py-1 print:border-slate-300"
              >
                <div className="text-[11.5px] font-extrabold text-slate-900 tracking-tight print:text-[8.5px] print:leading-tight">
                  Period {p}
                </div>
                <div className="inline-block mt-0.5 px-2 py-0.2 rounded-full bg-slate-200/70 text-[9.5px] font-medium text-slate-600 print:text-[7px] print:mt-0 print:bg-transparent print:p-0">
                  {PERIOD_TIMES[p]}
                </div>
              </th>
            ))}
          </tr>
        </thead>

        {/* Table Body (5 Days) */}
        <tbody className="divide-y divide-slate-100 bg-white print:divide-slate-300 print:bg-white">
          {DAYS.map((dayName, dIdx) => (
            <tr key={dayName} className="hover:bg-slate-50/40 transition-colors print:hover:bg-transparent">
              <td className="px-3 py-2 text-center font-extrabold text-slate-800 bg-slate-50/60 border-r border-slate-200 whitespace-nowrap align-middle print:w-[10%] print:px-1 print:py-1 print:text-[8.5px] print:border-slate-300 print:whitespace-normal print:bg-slate-50/90 print:text-slate-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-800 print:text-slate-700 print:text-[8.5px] print:font-black print:block">
                  {dayName}
                </span>
              </td>

              {PERIODS.map((p) => {
                const slot = matrix[dIdx][p];
                const slotKey = `${dIdx}-${p}`;
                const isExpanded = allExpanded || selectedSlotKey === slotKey;

                if (!slot) {
                  return (
                    <td
                      key={p}
                      className="p-1 border-r border-slate-200 last:border-r-0 align-middle min-w-[135px] h-[52px] print:min-w-0 print:w-[15%] print:h-auto print:p-0.5 print:border-slate-300"
                    >
                      <div className="h-full min-h-[48px] w-full rounded-lg border border-dashed border-slate-200 bg-slate-50/30 flex items-center justify-center p-1.5 text-slate-400 gap-1 transition-colors hover:bg-slate-50/60 print:min-h-[36px] print:border-slate-200 print:rounded print:text-[7.5px] print:p-0.5">
                        <CoffeeIcon className="w-3 h-3 text-slate-300 print:hidden" />
                        <span className="text-[10px] font-medium text-slate-400 tracking-tight print:text-[7.5px]">
                          Free
                        </span>
                      </div>
                    </td>
                  );
                }

                const isLab = slot.is_lab;
                const isElective = slot.is_elective;

                return (
                  <td
                    key={p}
                    onClick={() => handleCellClick(slot, slotKey)}
                    className="p-1 border-r border-slate-200 last:border-r-0 align-middle min-w-[135px] cursor-pointer print:min-w-0 print:w-[15%] print:h-auto print:p-0.5 print:border-slate-300"
                  >
                    {!isExpanded ? (
                      /* Compact View: Only Class Name and Colour */
                      <div
                        className={`h-full min-h-[48px] p-2 rounded-lg border transition-all duration-150 flex flex-col justify-center items-center text-center group hover:shadow-xs hover:scale-[1.01] print:min-h-[36px] print:p-1 print:rounded print:border-slate-300 print:shadow-none print:transform-none ${
                          isLab
                            ? 'bg-gradient-to-br from-purple-50/90 via-white to-purple-50/50 border-purple-200/90 text-purple-950 hover:border-purple-300 print:bg-purple-50/50 print:border-purple-200/90 print:text-purple-950'
                            : isElective
                            ? 'bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/50 border-emerald-200/90 text-emerald-950 hover:border-emerald-300 print:bg-emerald-50/50 print:border-emerald-200 print:text-emerald-950'
                            : 'bg-gradient-to-br from-blue-50/90 via-white to-indigo-50/50 border-blue-200/90 text-blue-950 hover:border-blue-300 print:bg-blue-50/40 print:border-blue-200/80 print:text-blue-950'
                        }`}
                        title={`${slot.subject_name}\nClick to view Faculty & Venue`}
                      >
                        <div className="flex items-center justify-center gap-1 w-full">
                          <span className="font-extrabold text-[11px] text-slate-900 leading-snug line-clamp-2 print:text-slate-900 print:text-[8px] print:leading-tight">
                            {slot.subject_name}
                          </span>
                          {isLab ? (
                            <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-purple-100 text-purple-700 border border-purple-200 uppercase flex-shrink-0 print:text-[6px] print:px-0.5 print:py-0">
                              LAB
                            </span>
                          ) : isElective ? (
                            <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase flex-shrink-0 print:text-[6px] print:px-0.5 print:py-0">
                              ELEC
                            </span>
                          ) : null}
                        </div>

                        {/* Complete details always rendered in print */}
                        <div className="hidden print:block text-[6.5px] text-slate-600 mt-0.5 leading-tight print:truncate">
                          <span>{slot.faculty_name}</span> · <span>{slot.room_name}</span>
                        </div>
                      </div>
                    ) : (
                      /* Expanded View on Click: Reveals Faculty and Venue */
                      <div
                        className={`h-full min-h-[96px] p-2.5 rounded-lg border transition-all duration-200 flex flex-col justify-between shadow-xs ring-2 print:min-h-[48px] print:p-1 print:border-slate-300 ${
                          isLab
                            ? 'bg-gradient-to-br from-purple-50 via-white to-purple-100/50 border-purple-300 ring-purple-400/40 text-purple-950'
                            : isElective
                            ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-100/50 border-emerald-300 ring-emerald-400/40 text-emerald-950'
                            : 'bg-gradient-to-br from-blue-50 via-white to-indigo-100/50 border-blue-300 ring-blue-400/40 text-blue-950'
                        }`}
                        title="Click to collapse"
                      >
                        <div>
                          {/* Course Name + Badge */}
                          <div className="flex items-start justify-between gap-1 mb-1">
                            <span className="font-extrabold text-[11.5px] text-slate-900 leading-tight print:text-[8px]">
                              {slot.subject_name}
                            </span>
                            {isLab ? (
                              <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-purple-100 text-purple-700 border border-purple-200 flex-shrink-0 uppercase">
                                LAB
                              </span>
                            ) : isElective ? (
                              <span className="px-1 py-0.2 rounded text-[7.5px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 flex-shrink-0 uppercase">
                                ELEC
                              </span>
                            ) : null}
                          </div>

                          {/* Faculty Instructor */}
                          <div className="flex items-center gap-1.5 text-[10.5px] text-slate-700 font-bold truncate mt-1">
                            <TeacherIcon className="w-3 h-3 text-blue-600 flex-shrink-0" />
                            <span className="truncate">{slot.faculty_name}</span>
                          </div>

                          {/* Room / Venue */}
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-600 font-semibold truncate mt-0.5">
                            <RoomIcon className="w-2.5 h-2.5 text-indigo-500 flex-shrink-0" />
                            <span className="truncate">{slot.room_name}</span>
                          </div>

                          {slot.batch_name && (
                            <div className="text-[9px] font-bold text-slate-400 truncate mt-0.5">
                              {slot.batch_name}
                            </div>
                          )}
                        </div>

                        {/* Action for HOD or collapse hint */}
                        {onSlotClick && !readonly ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onSlotClick(slot);
                            }}
                            className="mt-1.5 w-full py-1 px-1.5 rounded text-[9.5px] font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors shadow-2xs text-center"
                          >
                            Simulate / Swap
                          </button>
                        ) : (
                          <div className="mt-1 text-[8px] font-medium text-slate-400 text-right print:hidden">
                            click to collapse
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
