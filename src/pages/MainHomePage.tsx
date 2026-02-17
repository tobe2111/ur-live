import React from 'react'
import TopNav from '@/components/main/TopNav'
import HeroBanner from '@/components/main/HeroBanner'
import QuickAccess from '@/components/main/QuickAccess'
import ProductGrid from '@/components/main/ProductGrid'
import LiveNow from '@/components/main/LiveNow'
import BottomNav from '@/components/main/BottomNav'
import SiteFooter from '@/components/main/SiteFooter'

export default function MainHomePage() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNav />
      <main>
        <HeroBanner />
        <QuickAccess />
        <div className="h-px bg-border" />
        <ProductGrid />
        <div className="h-px bg-border" />
        <LiveNow />
      </main>
      <SiteFooter />
      <BottomNav />
    </div>
  )
}
