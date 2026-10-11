import { HashRouter, Route, Routes } from 'react-router-dom'
import { useStore } from './store'
import { FolderList, FolderView, KidForm, Settings, Login } from './screens'
import { BottomNav } from './ui'

export default function App() {
  const { ready, user } = useStore()
  if (!ready) return <div className="app"><div className="empty">Cargando…</div></div>
  if (!user) return <div className="app"><Login /></div>
  return (
    <HashRouter>
      <div className="app">
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
