// Sits at the top of the sidebar: hides it, or brings it back when hidden.
export default function SidebarToggle({ collapsed, onToggle }) {
  return (
    <button
      className="sidebar-toggle"
      onClick={onToggle}
      aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
      aria-expanded={!collapsed}
      title={collapsed ? 'Show sidebar' : 'Hide sidebar'}
    >
      <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
    </button>
  );
}
