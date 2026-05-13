import React from 'react';
import { Compass, ListTodo, UserCircle, LayoutDashboard, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { User } from 'firebase/auth';
import { motion } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  user: User;
}

export function Layout({ children, activeTab, setActiveTab, user }: LayoutProps) {
  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
    { id: 'discovery', label: 'Discovery', icon: Compass },
    { id: 'tracker', label: 'Applications', icon: ListTodo },
    { id: 'profile', label: 'Settings', icon: UserCircle },
  ];

  return (
    <div className="flex min-h-screen relative z-10">
      {/* Sidebar - Desktop */}
      <aside className="w-72 border-r border-white/10 bg-white/5 backdrop-blur-2xl hidden lg:flex flex-col p-8 fixed h-full shadow-2xl">
        <div className="flex items-center gap-3 mb-12">
          <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Compass className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-serif font-bold tracking-tight text-white italic">Career Compass</span>
        </div>

        <nav className="space-y-3 flex-grow">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative overflow-hidden",
                  activeTab === item.id 
                    ? "bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.05)] border border-white/10" 
                    : "text-white/40 hover:bg-white/5 hover:text-white"
                )}
              >
                {activeTab === item.id && (
                  <motion.div 
                    layoutId="active-nav"
                    className="absolute inset-0 bg-indigo-500/10 -z-10"
                  />
                )}
                <Icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-400" : "group-hover:text-indigo-400 transition-colors")} />
                <span className="font-semibold text-sm tracking-wide uppercase">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          <div className="flex items-center gap-4">
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
              alt="Avatar" 
              className="w-10 h-10 rounded-full border border-white/10 ring-2 ring-indigo-500/20 shadow-xl"
            />
            <div className="overflow-hidden">
              <p className="font-bold text-white truncate text-sm">{user.displayName}</p>
              <p className="text-[10px] text-white/40 truncate uppercase font-bold tracking-widest">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow lg:ml-72 p-6 lg:p-12 pb-24 lg:pb-12 bg-transparent">
        {children}
      </main>

      {/* Mobile Nav */}
      <nav className="lg:hidden fixed bottom-6 left-6 right-6 bg-white/5 backdrop-blur-2xl border border-white/10 px-6 py-4 rounded-[2.5rem] shadow-2xl flex justify-around items-center z-50">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "p-3 rounded-2xl transition-all",
                activeTab === item.id 
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/40" 
                  : "text-white/40 hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="w-6 h-6" />
            </button>
          );
        })}
      </nav>
    </div>
  );
}
