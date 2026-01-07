import { ReactNode } from "react";
import Sidebar from "./Sidebar";

type Props = {
  children: ReactNode;
};

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-slate-100">
      <div className="flex">
        {/* Sidebar SOLO desktop */}
        <Sidebar />

        {/* CONTENIDO */}
        <main className="flex-1 w-full p-4">
          {children}
        </main>
      </div>
    </div>
  );
}
