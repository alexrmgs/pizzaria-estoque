import Image from "next/image";
import { requireUser } from "@/lib/dal";
import { NavLinks } from "@/components/nav-links";
import { SignOutButton } from "@/components/sign-out-button";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { CollapsibleSidebar } from "@/components/collapsible-sidebar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <MobileSidebar permissions={user.role} userName={user.name ?? ""} roleName={user.role.name} />
      <CollapsibleSidebar>
        <div className="flex items-center gap-2 px-1 pr-8">
          <Image src="/logo.png" alt="FB Pizzaria & Esfiharia" width={40} height={39} priority />
          <div>
            <p className="text-sm leading-tight font-bold text-white">FB Pizzaria</p>
            <p className="text-[11px] leading-tight text-sidebar-foreground/80">
              Pizzaria &amp; Esfiharia
            </p>
          </div>
        </div>
        <NavLinks permissions={user.role} />
        <div className="mt-auto flex items-center justify-between gap-2 border-t border-sidebar-border pt-4">
          <div className="text-sm">
            <p className="font-medium text-white">{user.name}</p>
            <p className="text-sidebar-foreground/80">{user.role.name}</p>
          </div>
          <SignOutButton />
        </div>
      </CollapsibleSidebar>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
