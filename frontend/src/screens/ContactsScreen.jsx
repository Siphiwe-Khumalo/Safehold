import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.js'
import { ensureUserId } from '../lib/deviceUser.js'

const EMPTY = { name: '', phone: '', email: '', relationship: '', enabled: true }

export default function ContactsScreen() {
  const [userId, setUserId] = useState(null)
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (id) => {
    try {
      const list = await api.listContacts(id)
      setContacts(list)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    ensureUserId().then((id) => {
      setUserId(id)
      if (id) load(id)
      else {
        setLoading(false)
        setError('Cannot reach the server. Start the backend to manage contacts.')
      }
    })
  }, [load])

  const submit = async (e) => {
    e.preventDefault()
    if (!userId || !form.name.trim() || !form.phone.trim()) return
    setSaving(true)
    try {
      const created = await api.createContact(userId, form)
      setContacts((c) => [...c, created])
      setForm(EMPTY)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (contact) => {
    try {
      const updated = await api.updateContact(contact.id, userId, {
        enabled: !contact.enabled,
      })
      setContacts((c) => c.map((x) => (x.id === updated.id ? updated : x)))
    } catch (err) {
      setError(err.message)
    }
  }

  const remove = async (contact) => {
    try {
      await api.deleteContact(contact.id, userId)
      setContacts((c) => c.filter((x) => x.id !== contact.id))
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="min-h-full bg-ink text-white">
      <header className="flex items-center justify-between px-5 py-4">
        <Link
          to="/"
          className="rounded-lg px-2 py-2 text-sm font-semibold text-white/80 hover:underline"
        >
          ← Back
        </Link>
        <span className="text-lg font-black">Trusted contacts</span>
        <span className="w-12" />
      </header>

      <main className="mx-auto max-w-md px-5 pb-16">
        <p className="mb-6 text-sm text-white/70">
          These people are alerted with your location when you trigger an
          emergency. Add the people you trust most.
        </p>

        {error && (
          <p className="mb-4 rounded-lg bg-amber-500/20 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-white/60">Loading…</p>
        ) : (
          <ul className="mb-8 space-y-3">
            {contacts.length === 0 && (
              <li className="rounded-xl bg-white/5 p-4 text-sm text-white/60">
                No contacts yet. Add one below.
              </li>
            )}
            {contacts.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between rounded-xl bg-white/5 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {c.name}
                    {c.relationship ? (
                      <span className="ml-2 text-xs font-normal text-white/50">
                        {c.relationship}
                      </span>
                    ) : null}
                  </p>
                  <p className="truncate text-sm text-white/60">{c.phone}</p>
                  {c.email && (
                    <p className="truncate text-xs text-white/40">{c.email}</p>
                  )}
                </div>
                <div className="ml-3 flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => toggle(c)}
                    className={[
                      'rounded-lg px-3 py-1.5 text-xs font-bold',
                      c.enabled ? 'bg-safe text-white' : 'bg-white/10 text-white/60',
                    ].join(' ')}
                  >
                    {c.enabled ? 'On' : 'Off'}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    aria-label={`Remove ${c.name}`}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold text-white/70"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-white/5 p-4">
          <h2 className="text-base font-bold">Add a contact</h2>
          <Field
            label="Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            required
          />
          <Field
            label="Phone number"
            value={form.phone}
            onChange={(v) => setForm((f) => ({ ...f, phone: v }))}
            type="tel"
            placeholder="+27…"
            required
          />
          <Field
            label="Email (optional)"
            value={form.email}
            onChange={(v) => setForm((f) => ({ ...f, email: v }))}
            type="email"
          />
          <Field
            label="Relationship (optional)"
            value={form.relationship}
            onChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
            placeholder="Sister, friend, neighbour…"
          />
          <button
            type="submit"
            disabled={saving || !userId}
            className="w-full rounded-xl bg-danger py-3 font-bold disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add contact'}
          </button>
        </form>
      </main>
    </div>
  )
}

function Field({ label, value, onChange, type = 'text', required, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-white/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2.5 text-white placeholder-white/30 focus:border-white/40 focus:outline-none"
      />
    </label>
  )
}
