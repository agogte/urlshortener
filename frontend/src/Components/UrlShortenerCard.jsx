import React, { useState } from 'react'

const UrlShortenerCard = () => {
    const [link, setLink] = useState('')
    const [input, setInput] = useState('')
    

    // const fetchShortId = async () => {
    //     const response = await fetch('/hello')
    //     const result = await response.text()
    //     console.log(result)
    //     return result
    // }

    // const handleClick = async () => {
    //     const result = await fetchShortId()
    //     setLink(result)
    // }

    const handleGetYourLink = async (link) => {
        // PUT request using fetch inside useEffect React hook
        const requestOptions = {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ "url": link })
        };
        const res = await fetch('/', requestOptions)
        const result = await res.json()
        console.log(result.shortID)
        setLink(result.shortID)
    }

    // console.log(input)

    return (
        <div className="max-w-sm rounded-3xl overflow-hidden shadow-lg bg-white w-3/4">
            <div className="px-6 py-4 w-full">
                <div>
                    <p className='font-bold text-2xl text-center my-3'>Shorten a long link</p>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Paste your long URL</label>
                    <label className="block text-gray-700 text-xs font-bold mb-2">(Link must start with https://)</label>
                    <input className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        id="long_url" type="url" placeholder="http://example.com/example1/" value={input} onInput={e => setInput(e.target.value)}/>
                </div>
                {/* <div className='flex flex-row my-5 items-center justify-center'>
                    <span className='ml-0 mr-3'>
                        <label className="block text-gray-700 text-sm font-bold mb-2" for="long_url">Choose your domain</label>
                        <input className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="long_url" type="url" placeholder="https://shorten/" readOnly />
                    </span>
                    <span className='ml-3 mr-0'>
                        <label className="block text-gray-700 text-sm font-bold mb-2" for="long_url">Enter back half</label>
                        <input className="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="long_url" type="url" placeholder="(optional)" />
                    </span>
                </div> */}
                <div className='flex justify-center'>
                    <button className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 my-2 px-4 rounded-full" onClick={async () => {
                        // setLink(await fetchShortId())
                        handleGetYourLink(input)
                    }}>
                        Get your link
                    </button>
                </div>
                {link && (
                    <div className='flex flex-row'>
                        <input type="text" value={link} readOnly className='shadow appearance-none border w-2/3 mt-5 rounded-xl py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline' />
                        <button className="bg-blue-500 hover:bg-blue-800 active:outline-dashed active:ring active:ring-blue-300 text-white font-bold px-4 mx-5 h-10 mt-5 rounded-md" onClick={() => { navigator.clipboard.writeText('http://localhost:3001/'+link) }}>Copy</button>
                    </div>
                )}
            </div>

        </div>
    )
}

export default UrlShortenerCard