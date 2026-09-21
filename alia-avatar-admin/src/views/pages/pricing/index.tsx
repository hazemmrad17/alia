'use client'

import React, { useState } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Check, Sparkles, Zap, Shield, HelpCircle } from 'lucide-react'

export const PricingView = () => {
  const [isYearly, setIsYearly] = useState(true)

  const plans = [
    {
      name: 'Basic',
      badge: 'Starter',
      priceMonthly: 19,
      priceYearly: 15,
      description: 'A simple start for small teams, startups, and solo creators.',
      features: [
        '100 responses / mo',
        'Unlimited forms & surveys',
        'User management (up to 3)',
        'Basic analytics export',
        'Community support'
      ],
      popular: false,
      buttonText: 'Get Started'
    },
    {
      name: 'Standard',
      badge: 'Most Popular',
      priceMonthly: 49,
      priceYearly: 39,
      description: 'For growing companies that need flexible workflow automation.',
      features: [
        'Unlimited responses',
        'Unlimited forms & surveys',
        'User management (up to 20)',
        'Advanced visual charts & Recharts',
        'Custom webhooks & Stripe API',
        'Priority email support'
      ],
      popular: true,
      buttonText: 'Upgrade to Standard'
    },
    {
      name: 'Enterprise',
      badge: 'Dedicated',
      priceMonthly: 99,
      priceYearly: 79,
      description: 'Dedicated infrastructure, custom SLAs, and custom AI avatar models.',
      features: [
        'Everything in Standard',
        'Dedicated account manager',
        'Custom SSO / SAML integration',
        'Audit logs & 99.99% uptime SLA',
        'Custom doctor & avatar voice training',
        '24/7 Phone & Slack support'
      ],
      popular: false,
      buttonText: 'Contact Enterprise'
    }
  ]

  return (
    <div className='max-w-5xl mx-auto space-y-12 py-6'>
      {/* Header */}
      <div className='text-center space-y-4'>
        <Badge variant='secondary' className='bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1'>
          <Sparkles className='size-3.5 mr-1.5' /> Transparent Pricing
        </Badge>
        <h1 className='text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground'>
          Plans that scale with your growth
        </h1>
        <p className='text-muted-foreground text-sm max-w-xl mx-auto'>
          Choose the right plan for your team. All plans include automated sync, SSL security, and 14-day free trial.
        </p>

        {/* Monthly/Yearly toggle */}
        <div className='flex items-center justify-center gap-3 pt-2'>
          <span className={`text-sm font-medium ${!isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Monthly
          </span>
          <Switch checked={isYearly} onCheckedChange={setIsYearly} />
          <span className={`text-sm font-medium ${isYearly ? 'text-foreground' : 'text-muted-foreground'}`}>
            Yearly <span className='text-xs text-emerald-500 font-semibold'>(-20% Save)</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards Grid */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch'>
        {plans.map((plan, index) => {
          const price = isYearly ? plan.priceYearly : plan.priceMonthly
          return (
            <Card
              key={index}
              className={`p-6 flex flex-col justify-between relative transition-all ${
                plan.popular
                  ? 'border-primary ring-2 ring-primary/20 shadow-lg bg-card'
                  : 'border-border bg-card/60'
              }`}
            >
              {plan.popular && (
                <div className='absolute -top-3 left-1/2 -translate-x-1/2'>
                  <Badge className='bg-primary text-primary-foreground font-semibold text-xs px-3 py-0.5 shadow-sm'>
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div>
                <div className='flex justify-between items-center mb-2'>
                  <h3 className='text-xl font-bold text-foreground'>{plan.name}</h3>
                  {!plan.popular && (
                    <Badge variant='outline' className='text-xs font-normal'>
                      {plan.badge}
                    </Badge>
                  )}
                </div>

                <p className='text-xs text-muted-foreground min-h-[36px] mb-6'>
                  {plan.description}
                </p>

                <div className='flex items-baseline gap-1 mb-6 pb-6 border-b border-border'>
                  <span className='text-4xl font-extrabold text-foreground'>${price}</span>
                  <span className='text-xs text-muted-foreground'>/ month</span>
                </div>

                <div className='space-y-3 mb-8 text-xs'>
                  <span className='text-xs font-semibold text-foreground uppercase tracking-wider block'>
                    What&apos;s included:
                  </span>
                  {plan.features.map((feat, fIdx) => (
                    <div key={fIdx} className='flex items-start gap-2.5'>
                      <Check className='size-4 text-emerald-500 shrink-0 mt-0.5' />
                      <span className='text-foreground'>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                variant={plan.popular ? 'default' : 'outline'}
                className='w-full font-semibold text-xs h-10'
              >
                {plan.buttonText}
              </Button>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
export default PricingView
