import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import RoomJoin from './RoomJoin'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <RoomJoin/>
    </>
  )
}

export default App
