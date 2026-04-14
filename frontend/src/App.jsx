import React, { useState } from 'react'
import LandingPage from './components/LandingPage'
import MultiStepForm from './components/MultiStepForm'
import ResultsPage from './components/ResultsPage'

export default function App() {
  const [page, setPage] = useState('landing') // 'landing' | 'form' | 'results'
  const [tripData, setTripData] = useState(null)

  const handleStartPlanning = () => setPage('form')

  const handleTripCalculated = (data) => {
    setTripData(data)
    setPage('results')
  }

  const handleReset = () => {
    setTripData(null)
    setPage('landing')
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      {page === 'landing' && (
        <LandingPage onStart={handleStartPlanning} />
      )}
      {page === 'form' && (
        <MultiStepForm
          onComplete={handleTripCalculated}
          onBack={() => setPage('landing')}
        />
      )}
      {page === 'results' && tripData && (
        <ResultsPage
          data={tripData}
          onReset={handleReset}
        />
      )}
    </div>
  )
}
