import { memo, useRef, useState, useEffect } from 'react';
import { NAME_CASE_CSS } from './constants';

// Memoized cell component for better performance
export const PlanningCell = memo(
  ({ value, canEdit, onChange, blocked, datalistId, nameCase, reason }) => {
    const textTransform = NAME_CASE_CSS[nameCase] || "none";
    if (blocked) {
      return (
        <span className="w-full h-7 block bg-gray-300 dark:bg-gray-600 print:bg-gray-300"></span>
      );
    }
    if (!canEdit) {
      // Names from the Effectif must stay fully legible: wrap instead of
      // clipping, and keep a title tooltip as a fallback.
      return (
        <span
          className="text-center block text-xs leading-tight py-1 px-0.5 font-medium break-words whitespace-normal"
          style={{ textTransform }}
          title={reason ? `${value || ""}\n[Lecture seule] ${reason}` : value || ""}
        >
          {value || "-"}
        </span>
      );
    }

    return (
      <input
        type="text"
        list={datalistId || "tech-list"}
        title={value || ""}
        className="w-full h-7 text-xs border-0 bg-transparent px-1 focus:outline-none focus:ring-1 focus:ring-primary rounded"
        style={{ textTransform }}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="-"
      />
    );
  },
);

// Phones: the Planning table has fixed column widths (220px label + 115px
// per date) so it can't reflow to fit a narrow screen — on desktop/tablet
// that's fine, it just scrolls horizontally (overflow-x-auto). On phones
// we instead scale the whole table down to fit, same technique used for
// the mobile Organigramme, so nothing needs to be scrolled to be seen.
//
// The table itself has a `w-full` (width:100%) class. Measuring its
// wrapper's own auto/shrink-to-fit width would create a circular
// reference (wrapper's width depends on the table's content, but the
// table's width depends on the wrapper being 100% of it) — in practice
// this made the browser fall back to a nonsensical ~1,000,000px "natural"
// width. To avoid that entirely, the caller passes the already-known
// natural width (sum of the fixed column widths) as `naturalWidth`, and
// we give the inner wrapper that exact width explicitly — that breaks the
// circularity outright, so both the width AND the resulting height are
// laid out correctly by the browser with no measurement voodoo needed.
// justify-center on the outer wrapper keeps the shrunk table centered.
export const ScaleToFitMobile = ({ children, naturalWidth }) => {
  const wrapperRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [wrapHeight, setWrapHeight] = useState(null);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const compute = () => {
      const isMobile = mq.matches;
      setActive(isMobile);
      const wrapper = wrapperRef.current;
      const inner = innerRef.current;
      if (!isMobile || !wrapper || !inner || !naturalWidth) {
        setScale(1);
        setWrapHeight(null);
        return;
      }
      const available = wrapper.clientWidth;
      const naturalHeight = inner.scrollHeight;
      if (!available) return;
      const next = Math.min(1, (available - 4) / naturalWidth);
      setScale(next);
      setWrapHeight(Math.ceil(naturalHeight * next));
    };
    compute();
    const t = setTimeout(compute, 100);
    const mqListener = () => compute();
    window.addEventListener("resize", compute);
    window.addEventListener("orientationchange", compute);
    if (mq.addEventListener) mq.addEventListener("change", mqListener);
    else mq.addListener(mqListener);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", compute);
      window.removeEventListener("orientationchange", compute);
      if (mq.removeEventListener) mq.removeEventListener("change", mqListener);
      else mq.removeListener(mqListener);
    };
  }, [naturalWidth]);

  return (
    <div
      ref={wrapperRef}
      className={
        active
          ? "w-full overflow-hidden flex justify-center"
          : "w-full overflow-x-auto"
      }
      style={active && wrapHeight ? { height: wrapHeight } : undefined}
    >
      <div
        ref={innerRef}
        style={
          active
            ? {
                width: naturalWidth,
                flexShrink: 0,
                transform: `scale(${scale})`,
                transformOrigin: "top center",
              }
            : undefined
        }
      >
        {children}
      </div>
    </div>
  );
};
PlanningCell.displayName = "PlanningCell";
