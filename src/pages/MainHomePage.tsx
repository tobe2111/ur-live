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
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="pb-20">
        <HeroBanner />
        <QuickAccess />
        <div className="h-px bg-border" />
        <ProductGrid />
        <div className="h-px bg-border" />
        <LiveNow />
        <SiteFooter />
      </main>
      <BottomNav />
    </div>
  )
}
