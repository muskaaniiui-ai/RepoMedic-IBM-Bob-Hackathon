/** Placeholder page shown when a section is not yet implemented. */
interface PlaceholderPageProps {
  title: string
  description: string
}

export default function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-8">
      <div className="w-16 h-16 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-6">
        <span className="text-2xl text-gray-500">🔬</span>
      </div>
      <h2 className="text-xl font-semibold text-white mb-2">{title}</h2>
      <p className="text-gray-400 text-sm max-w-md leading-relaxed">{description}</p>
      <span className="mt-4 inline-block px-3 py-1 rounded-full bg-gray-800 text-amber-400 text-xs font-medium border border-amber-500/30">
        Coming soon
      </span>
    </div>
  )
}
