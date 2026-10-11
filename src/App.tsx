import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { useStore, clearError } from './store'
import { FolderList, FolderView, KidForm, Settings, Login } from './screens'
import { SessionList, SessionView } from './sessions'
import { Recorder } from './recorder'
import { ScoreKids, ScoreSkill } from './scoring'
import { ResultList, ResultView } from './results'
import { BottomNav } from './ui'

function Shell() {
  const { error } = useStore()
  const loc = useLocation()
  const fullScreen = loc.pathname.endsWith('/grabar') || /\/puntuar\/[^/]+\/[^/]+$/.test(loc.pathname)
  return (
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
        <Route path="/sesiones" element={<SessionList />} />
        <Route path="/sesion/:id" element={<SessionView />} />
        <Route path="/sesion/:id/grabar" element={<Recorder />} />
        <Route path="/sesion/:id/puntuar" element={<ScoreKids />} />
        <Route path="/sesion/:id/puntuar/:kidId/:skillId" element={<ScoreSkill />} />
        <Route path="/sesion/:id/resultados" element={<ResultList />} />
        <Route path="/sesion/:id/resultados/:kidId" element={<ResultView />} />
        <Route path="/ajustes" element={<Settings />} />
      </Routes>
      {!fullScreen && <BottomNav />}
    </div>
  )
}

export default function App() {
  const { ready, user } = useStore()
  if (!ready) return <div className="app"><div className="empty">Cargando…</div></div>
  if (!user) return <div className="app"><Login /></div>
  return <HashRouter><Shell /></HashRouter>
}
