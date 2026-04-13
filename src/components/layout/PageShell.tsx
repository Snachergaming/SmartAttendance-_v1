import React, { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  GraduationCap,
  BookOpen,
  Calendar,
  ClipboardList,
  FileBarChart,
  Settings,
  LogOut,
  Menu,
  X,
  UserCog,
  CalendarOff,
  AlertTriangle,
  Link2,
  CalendarDays,
  RefreshCw,
  Book,
  Home,
  MoreHorizontal,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  category?: string;
}

const adminNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, category: 'main' },
  { label: 'Faculty', path: '/admin/faculty', icon: <UserCog className="w-5 h-5" />, category: 'management' },
  { label: 'Classes', path: '/admin/classes', icon: <GraduationCap className="w-5 h-5" />, category: 'management' },
  { label: 'Subjects', path: '/admin/subjects', icon: <BookOpen className="w-5 h-5" />, category: 'management' },
  { label: 'Allocations', path: '/admin/allocations', icon: <Link2 className="w-5 h-5" />, category: 'management' },
  { label: 'Students', path: '/admin/students', icon: <Users className="w-5 h-5" />, category: 'management' },
  { label: 'Batches', path: '/admin/batches', icon: <Users className="w-5 h-5" />, category: 'management' },
  { label: 'Timetable', path: '/admin/timetable', icon: <Calendar className="w-5 h-5" />, category: 'schedule' },
  { label: 'Holidays', path: '/admin/holidays', icon: <CalendarDays className="w-5 h-5" />, category: 'schedule' },
  { label: 'Faculty Leave', path: '/admin/faculty-leave', icon: <CalendarOff className="w-5 h-5" />, category: 'schedule' },
  { label: 'Substitutions', path: '/admin/substitutions', icon: <RefreshCw className="w-5 h-5" />, category: 'schedule' },
  { label: 'Attendance', path: '/admin/attendance-monitor', icon: <ClipboardList className="w-5 h-5" />, category: 'attendance' },
  { label: 'Defaulters', path: '/admin/defaulters', icon: <AlertTriangle className="w-5 h-5" />, category: 'reports' },
  { label: 'Absentee Book', path: '/admin/fines', icon: <Book className="w-5 h-5" />, category: 'reports' },
  { label: 'Reports', path: '/admin/reports', icon: <FileBarChart className="w-5 h-5" />, category: 'reports' },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="w-5 h-5" />, category: 'settings' },
];

const facultyNavItems: NavItem[] = [
  { label: 'Dashboard', path: '/faculty/dashboard', icon: <LayoutDashboard className="w-5 h-5" />, category: 'main' },
  { label: "Today's Lectures", path: '/faculty/today', icon: <Calendar className="w-5 h-5" />, category: 'main' },
  { label: 'My Class', path: '/faculty/my-class', icon: <Users className="w-5 h-5" />, category: 'main' },
  { label: 'Leave', path: '/faculty/leave', icon: <CalendarOff className="w-5 h-5" />, category: 'schedule' },
  { label: 'Reports', path: '/faculty/reports', icon: <FileBarChart className="w-5 h-5" />, category: 'reports' },
  { label: 'My Subjects', path: '/faculty/subjects', icon: <BookOpen className="w-5 h-5" />, category: 'management' },
  { label: 'Batches', path: '/faculty/batches', icon: <Users className="w-5 h-5" />, category: 'management' },
  { label: 'Settings', path: '/faculty/settings', icon: <Settings className="w-5 h-5" />, category: 'settings' },
];

// Bottom nav items for mobile (most used features)
const adminBottomNavItems = [
  { label: 'Home', path: '/admin/dashboard', icon: <Home className="w-6 h-6" /> },
  { label: 'Reports', path: '/admin/reports', icon: <FileBarChart className="w-6 h-6" /> },
  { label: 'Settings', path: '/admin/settings', icon: <Settings className="w-6 h-6" /> },
  { label: 'More', path: 'menu', icon: <Menu className="w-6 h-6" /> },
];

const facultyBottomNavItems = [
  { label: 'Home', path: '/faculty/dashboard', icon: <Home className="w-6 h-6" /> },
  { label: 'Today', path: '/faculty/today', icon: <Calendar className="w-6 h-6" /> },
  { label: 'Class', path: '/faculty/my-class', icon: <Users className="w-6 h-6" /> },
  { label: 'Reports', path: '/faculty/reports', icon: <FileBarChart className="w-6 h-6" /> },
  { label: 'More', path: 'menu', icon: <Menu className="w-6 h-6" /> },
];

interface PageShellProps {
  children: React.ReactNode;
  role: 'admin' | 'faculty';
}

export const PageShell: React.FC<PageShellProps> = ({ children, role }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();

  const navItems = role === 'admin' ? adminNavItems : facultyNavItems;
  const bottomNavItems = role === 'admin' ? adminBottomNavItems : facultyBottomNavItems;

  const handleLogout = async () => {
    await signOut();
    navigate(role === 'admin' ? '/login/admin' : '/login/faculty');
  };

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  // Group nav items by category for mobile menu
  const groupedNavItems = useMemo(() => {
    const groups: { [key: string]: NavItem[] } = {};
    navItems.forEach(item => {
      const category = item.category || 'other';
      if (!groups[category]) groups[category] = [];
      groups[category].push(item);
    });
    return groups;
  }, [navItems]);

  const categoryLabels: { [key: string]: string } = {
    main: 'Main',
    enrollment: 'Enrollment',
    management: 'Management',
    schedule: 'Schedule',
    attendance: 'Attendance',
    tools: 'Tools',
    reports: 'Reports',
    settings: 'Settings',
  };

  const handleBottomNavClick = (path: string) => {
    if (path === 'menu') {
      setSidebarOpen(true);
    } else {
      navigate(path);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      {/* Mobile Header - Simplified Android-like AppBar */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg pt-[env(safe-area-inset-top)]">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center ring-2 ring-white/30">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-display font-bold text-sm">Smart Attendance</span>
              <p className="text-[10px] opacity-80">{today}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-white/10 h-10 w-10"
              onClick={() => setSidebarOpen(true)}
            >
              <MoreHorizontal className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Full-Screen Menu Drawer */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="lg:hidden fixed right-0 top-0 bottom-0 w-full max-w-sm bg-background z-50 flex flex-col shadow-2xl"
              style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {/* Menu Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-primary text-primary-foreground">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="font-bold">Menu</h2>
                    <p className="text-xs opacity-80">{user?.email}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(false)}
                  className="text-primary-foreground hover:bg-white/10"
                >
                  <X className="w-6 h-6" />
                </Button>
              </div>

              {/* Menu Items - Scrollable */}
              <nav className="flex-1 overflow-y-auto">
                {Object.entries(groupedNavItems).map(([category, items]) => (
                  <div key={category} className="py-2">
                    <h3 className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {categoryLabels[category] || category}
                    </h3>
                    {items.map((item) => {
                      const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                      return (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setSidebarOpen(false)}
                          className={`flex items-center justify-between px-4 py-3.5 mx-2 rounded-xl transition-all active:scale-98 ${isActive
                            ? 'bg-primary/15 text-primary'
                            : 'text-foreground hover:bg-muted/50 active:bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`p-2 rounded-full ${isActive ? 'bg-primary/20' : 'bg-muted/50'}`}>
                              {item.icon}
                            </div>
                            <span className="font-medium">{item.label}</span>
                          </div>
                          <ChevronRight className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              {/* Logout Button */}
              <div className="p-4 border-t border-border/50">
                <Button
                  variant="outline"
                  onClick={handleLogout}
                  className="w-full h-12 text-red-500 border-red-200 hover:bg-red-50 hover:text-red-600 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  <LogOut className="w-5 h-5 mr-2" />
                  Logout
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Top Navigation */}
      <header className="hidden lg:flex fixed top-0 left-0 right-0 z-40 border-b border-border/30 bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-2 ring-primary/30">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display text-base font-bold text-foreground">Smart Attendance</h1>
              <p className="text-xs text-muted-foreground">Attendance Management</p>
            </div>
          </div>

          <nav className="flex-1 overflow-x-auto">
            <ul className="flex items-center gap-2 whitespace-nowrap">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${isActive
                        ? 'bg-primary/15 text-primary border-primary'
                        : 'bg-white/90 text-muted-foreground border-border/60 hover:bg-primary/5 hover:text-foreground'
                        }`}>
                      {item.icon}
                      <span className="hidden xl:inline-block">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="flex items-center gap-3">
            <div className="text-right text-xs text-muted-foreground">
              <p>{user?.email}</p>
              <p>{today}</p>
            </div>
            <Button
              variant="outline"
              onClick={handleLogout}
              className="h-10 rounded-full border-border/50 text-muted-foreground hover:text-foreground hover:bg-white/5"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[calc(3.5rem+env(safe-area-inset-top))] lg:pt-[7rem] pb-[calc(4.5rem+env(safe-area-inset-bottom))] lg:pb-0">
        <div className="p-3 sm:p-4 lg:p-6">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation - Android Style */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background border-t border-border/50 shadow-lg" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const isActive = item.path !== 'menu' && (location.pathname === item.path || location.pathname.startsWith(item.path + '/'));
            return (
              <button
                key={item.path}
                onClick={() => handleBottomNavClick(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors active:bg-primary/10 ${isActive
                  ? 'text-primary'
                  : 'text-muted-foreground'
                }`}
              >
                <div className={`p-1 rounded-full transition-all ${isActive ? 'bg-primary/15' : ''}`}>
                  {item.icon}
                </div>
                <span className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-primary' : ''}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default PageShell;
