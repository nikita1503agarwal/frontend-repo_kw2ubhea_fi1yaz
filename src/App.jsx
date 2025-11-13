import { useEffect, useMemo, useRef, useState } from 'react'
import Spline from '@splinetool/react-spline'

function useAuth() {
  const [token, setToken] = useState(localStorage.getItem('vaakya_token') || '')
  const [email, setEmail] = useState('demo@vaakya.app')
  const [password, setPassword] = useState('demo12345')
  const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'

  const registerOrLogin = async () => {
    try {
      // Try register
      const reg = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Demo', email, password }),
      })
      if (reg.ok) {
        const data = await reg.json()
        localStorage.setItem('vaakya_token', data.accessToken)
        setToken(data.accessToken)
        return
      }
    } catch {}
    // Fallback to login
    const form = new URLSearchParams()
    form.set('username', email)
    form.set('password', password)
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
    const data = await res.json()
    if (res.ok) {
      localStorage.setItem('vaakya_token', data.accessToken)
      setToken(data.accessToken)
    }
  }

  return { token, email, password, setEmail, setPassword, registerOrLogin, baseUrl }
}

function Recorder({ onBlob }) {
  const mediaRef = useRef(null)
  const chunksRef = useRef([])
  const [recording, setRecording] = useState(false)

  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream)
    mediaRef.current = mr
    chunksRef.current = []
    mr.ondataavailable = (e) => chunksRef.current.push(e.data)
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
      onBlob(blob)
      stream.getTracks().forEach(t => t.stop())
    }
    mr.start(250)
    setRecording(true)
  }

  const stop = () => {
    if (mediaRef.current && recording) {
      mediaRef.current.stop()
      setRecording(false)
    }
  }

  return (
    <div className="flex items-center gap-3">
      {!recording ? (
        <button onClick={start} className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700 transition">Record</button>
      ) : (
        <button onClick={stop} className="px-4 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 transition animate-pulse">Stop</button>
      )}
    </div>
  )
}

function Hero() {
  return (
    <div className="relative h-[360px] w-full overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-50 via-purple-50 to-amber-50">
      <Spline scene="https://prod.spline.design/4cHQr84zOGAHOehh/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/70 to-transparent" />
    </div>
  )
}

export default function App() {
  const { token, registerOrLogin, baseUrl } = useAuth()
  const [transcript, setTranscript] = useState('')
  const [language, setLanguage] = useState('hi')
  const [voices, setVoices] = useState([])
  const [ttsJob, setTtsJob] = useState(null)
  const [text, setText] = useState('नमस्ते! Welcome to Vaakya.')

  useEffect(() => {
    if (!token) registerOrLogin()
  }, [token])

  useEffect(() => {
    const fetchVoices = async () => {
      if (!token) return
      const res = await fetch(`${baseUrl}/api/voices`)
      const data = await res.json()
      setVoices(data)
    }
    fetchVoices()
  }, [token, baseUrl])

  const handleUpload = async (blob) => {
    if (!token) return
    const fd = new FormData()
    fd.append('file', blob, 'recording.webm')
    fd.append('language', language)
    const res = await fetch(`${baseUrl}/api/stt/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    })
    const data = await res.json()
    if (data.jobId) {
      const statusRes = await fetch(`${baseUrl}/api/stt/job/${data.jobId}`, { headers: { Authorization: `Bearer ${token}` } })
      const st = await statusRes.json()
      setTranscript(st.transcript || '')
    }
  }

  const synthesize = async () => {
    if (!token || voices.length === 0) return
    const voice = voices[0]
    const res = await fetch(`${baseUrl}/api/tts/synthesize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ text, voice: voice.id, language: language, speed: 1.0, pitch: 1.0 }),
    })
    const data = await res.json()
    if (data.jobId) {
      const jr = await fetch(`${baseUrl}/api/tts/job/${data.jobId}`, { headers: { Authorization: `Bearer ${token}` } })
      const jdata = await jr.json()
      setTtsJob(jdata)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="space-y-6">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">VAAKYA — Voice Studio for Indian Languages</h1>
          <p className="text-slate-600">Record, transcribe, edit, and synthesize natural voices across major Indian languages. This MVP uses local, open-source defaults and can be swapped to cloud later.</p>
          <Hero />
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="p-6 rounded-xl border bg-white shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Speech to Text</h2>
            <div className="flex gap-3 items-center">
              <label className="text-sm">Language</label>
              <select className="border rounded px-2 py-1" value={language} onChange={e=>setLanguage(e.target.value)}>
                {['hi','en-IN','bn','te','mr','ta','ur','gu','kn','ml','pa','or','as'].map(l=> (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <Recorder onBlob={handleUpload} />
            <div>
              <label className="text-sm font-medium">Transcript</label>
              <textarea className="mt-2 w-full h-40 border rounded-lg p-3" value={transcript} onChange={e=>setTranscript(e.target.value)} />
            </div>
          </div>

          <div className="p-6 rounded-xl border bg-white shadow-sm space-y-4">
            <h2 className="text-xl font-semibold">Text to Speech</h2>
            <div className="flex gap-3 items-center">
              <label className="text-sm">Voice</label>
              <select className="border rounded px-2 py-1">
                {voices.map(v => (
                  <option key={v.id} value={v.id}>{v.name} • {v.language}</option>
                ))}
              </select>
            </div>
            <textarea className="mt-2 w-full h-32 border rounded-lg p-3" value={text} onChange={e=>setText(e.target.value)} />
            <button onClick={synthesize} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition">Synthesize</button>
            {ttsJob?.url_to_audio && (
              <audio controls className="w-full mt-3">
                <source src={`${baseUrl}${ttsJob.url_to_audio}`} type="audio/wav" />
              </audio>
            )}
          </div>
        </div>

        <div className="text-xs text-slate-500">Demo account is created automatically on first load.</div>
      </div>
    </div>
  )
}
