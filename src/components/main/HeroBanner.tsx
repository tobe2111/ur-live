import React from 'react'

export default function HeroBanner() {
  return (
    <section className="relative w-full overflow-hidden">
      <div className="relative aspect-[3/4] w-full sm:aspect-[16/9]">
        {/* Hero Image - Placeholder with gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-800 via-gray-600 to-gray-900" />
        
        {/* Overlay */}
        <div className="absolute inset-0 bg-black/20" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-12 px-6 text-center">
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.3em] text-white/80">
            Limited Edition
          </p>
          <h2 className="text-3xl font-extrabold uppercase tracking-tight text-white sm:text-5xl" style={{ textWrap: 'balance' }}>
            New Drops Are Here
          </h2>
          <p className="mt-3 text-sm font-light text-white/80 max-w-xs">
            Shop the latest arrivals from top brands
          </p>
          <button 
            onClick={() => window.scrollTo({ top: 600, behavior: 'smooth' })}
            className="mt-5 bg-white text-gray-900 px-8 py-3 text-sm font-semibold uppercase tracking-wider hover:bg-gray-100 transition-colors"
          >
            Shop Now
          </button>
        </div>
      </div>
    </section>
  )
}
