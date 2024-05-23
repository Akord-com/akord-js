import { Akord, Auth } from '@akord/akord-js'
import type { NextPage } from 'next'
import Head from 'next/head'
import { useState } from 'react'


const Home: NextPage = () => {
  const [akord, setAkord] = useState<Akord | null>()
  const [email, setEmail] = useState<string>('')
  const [pass, setPass] = useState<string>('')

  const handleLogin = async (event: any) => {
    event.preventDefault();
    if (!email) {
      throw new Error('Missing email')
    }
    if (!pass) {
      throw new Error('Missing pass')
    }
    const {  wallet } = await Auth.signIn(email, pass);
    const akord = new Akord(wallet)
    setAkord(akord)
  }

  const loginForm = () => {
    return <div className={'p-3'} style={{ width: '340px', backgroundColor: '#fff', color: 'black' }}>
      <h1 className="display-6 mb-3">Login</h1>
      <form onSubmit={handleLogin}>
        <div className="mb-3">
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ color: 'black' }}
          />
        </div>

        <div className="mb-3">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            style={{ color: 'black' }}
          />
        </div>
        <button type="submit" className="btn btn-primary">Login</button>
      </form>
    </div>
  }

  const handleUpload = async (files: FileList | null) => {
    if (!akord) {
      throw new Error('Akord-js not initialized')
    }
    if (!files || !files.length) {
      throw new Error('Failed uploading the file')
    }
    const file = files[0]
    const vaults = await akord?.vault.list()
    if (!vaults.items || !vaults.items.length) {
      throw new Error('User does not have any vaults')
    }
    const vault = vaults.items[0]
    confirm("Uploading file to vault: " + vault.name)
    const { stackId } = await akord.stack.create(vault.id, file)
    confirm("Created stack: " + stackId)
    setAkord(null)
  }

  const uploadForm = () => {
    return <div className={'p-3'} style={{ width: '340px', backgroundColor: '#fff' }}>
      <h1 className="display-6 mb-3">Upload</h1>
      <form>
        <input
          type="file"
          onChange={(e) => handleUpload(e.target.files)}
        />
      </form>
    </div>
  }

  return (
    <div>
      <Head>
        <title>AkordJS &lt;&gt; Next.js starter</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className="vh-100 d-flex justify-content-center align-items-center">
        {akord ? uploadForm() : loginForm()}
      </main>
    </div>
  )
}

export default Home