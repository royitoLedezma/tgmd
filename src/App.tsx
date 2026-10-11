import { HashRouter, Route, Routes } from 'react-router-dom'
import { useStore, clearError } from './store'
import { FolderList, FolderView, KidForm, Settings, Login } from './screens'
import { BottomNav } from './ui'

export default function App() {
  const { ready, user, error } = useStore()
  if (!ready) return <div className="app"><div className="empty">Cargando…</div></div>
  if (!user) return <div className="app"><Login /></div>
  return (
    <HashRouter>
      <div className="app">
        {error && (
          <div role="alert" className="banner warn" style={{ margin: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ flex: 1 }}>{error}</span>
            <button className="icon-btn light" style={{ width: 36, height: 36 }} aria-label="Cerrar aviso" onClick={clearError}>✕</button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<FolderList />} />
          <Route path="/carpeta/:id" element={<FolderView />} />
          <Route path="/nino/nuevo" element={<KidForm />} />
          <Route path="/nino/:id" element={<KidForm />} />
          <Route path="/ajustes" element={<Settings />} />
        </Routes>
        <BottomNav />
      </div>
    </HashRouter>
  )
}
