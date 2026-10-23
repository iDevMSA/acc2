import React from "react";
import { NavLink } from "react-router-dom";
import Icon from "../ui/Icon";
import { cx } from "../ui/primitives";
import { visibleGroups } from "./navigation";
import { useApp } from "../../context/AppContext";

// شريط التنقل السفلي على الهاتف — نفس عناصر القائمة الجانبية، بمتناول الإبهام.
const BottomNav: React.FC = () => {
  const { member } = useApp();
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="flex">
        {visibleGroups(member)
          .flatMap((g) => g.items)
          .filter((i) => i.mobile)
          .map((item) => (
            <li key={item.path} className="flex-1">
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className={({ isActive }) =>
                  cx(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                    isActive
                      ? "text-brand-600"
                      : "text-ink-subtle active:bg-slate-100",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cx(
                        "grid h-7 w-12 place-items-center rounded-full transition",
                        isActive && "bg-brand-50",
                      )}
                    >
                      <Icon name={item.icon} size={20} />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
      </ul>
    </nav>
  );
};

export default BottomNav;
