import type { CategoryFilter } from "../../components/tasks-calendar/types";
import { MiniCalendar } from "./MiniCalendar";
import { ProductivitySidebar, SidebarNavItem, SidebarSection } from "../ProductivitySidebar";

const CATEGORIES: CategoryFilter[] = ["All", "Work", "Personal", "School", "Fitness"];

interface Props {
  viewDate: Date;
  categoryFilter: CategoryFilter;
  onCategoryChange: (cat: CategoryFilter) => void;
  onViewDateChange: (date: Date) => void;
  onGoTasks?: () => void;
}

export function CalendarLeftRail({
  viewDate,
  categoryFilter,
  onCategoryChange,
  onViewDateChange,
  onGoTasks,
}: Props) {
  return (
    <ProductivitySidebar title="Calendar">
      <MiniCalendar
        viewDate={viewDate}
        selectedDate={viewDate}
        onSelectDate={onViewDateChange}
        onMonthChange={onViewDateChange}
      />
      <SidebarSection label="Calendars">
        {CATEGORIES.map((cat) => (
          <SidebarNavItem
            key={cat}
            label={cat}
            active={categoryFilter === cat}
            onClick={() => onCategoryChange(cat)}
          />
        ))}
      </SidebarSection>
      {onGoTasks ? (
        <SidebarNavItem label="Open Tasks" active={false} onClick={onGoTasks} />
      ) : null}
    </ProductivitySidebar>
  );
}
