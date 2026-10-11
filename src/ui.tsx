import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button className="backdrop" aria-label="Cerrar" onClick={onClose} />
      <div className="sheet">
        <h2>{title}</h2>
        {children}
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
      </div>
    </div>
  )
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

export const Icon = {
  back: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>,
  chevron: <svg width="18" height="18" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4} aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>,
  more: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>,
  folder: (color: string) => <svg width="30" height="30" viewBox="0 0 24 24" {...stroke} stroke={color} strokeWidth={1.8} aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></svg>,
  folderNav: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2.5h8.5A1.5 1.5 0 0 1 21 9v9.5a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" /></svg>,
  gear: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  camera: <svg width="22" height="22" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-3v10l-5-3" /></svg>,
  trash: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" /></svg>,
  edit: <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>,
}

export function BottomNav() {
  return (
    <nav className="nav" aria-label="Secciones">
      <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>{Icon.folderNav}Carpetas</NavLink>
      <NavLink to="/sesiones" className={({ isActive }) => (isActive ? 'active' : '')}>{Icon.camera}Sesiones</NavLink>
      <NavLink to="/ajustes" className={({ isActive }) => (isActive ? 'active' : '')}>{Icon.gear}Ajustes</NavLink>
    </nav>
  )
}

export function Top({ title, sub, back, right }: { title: string; sub?: string; back?: string; right?: ReactNode }) {
  const nav = useNavigate()
  return (
    <header className="top">
      {back && <button className="icon-btn" aria-label="Volver" onClick={() => nav(back)}>{Icon.back}</button>}
      <div className="grow"><h1>{title}</h1>{sub && <span className="sub">{sub}</span>}</div>
      {right}
    </header>
  )
}
