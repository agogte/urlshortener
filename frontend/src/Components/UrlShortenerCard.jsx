import React, { useState } from 'react'

const UrlShortenerCard = () => {
    const [link, setLink] = useState('')


    return (
        <div class="max-w-sm rounded-3xl overflow-hidden shadow-lg bg-white w-3/4">
            <div class="px-6 py-4 w-full">
                <div>
                    <p className='font-bold text-2xl text-center my-3'>Shorten a long link</p>
                    <label class="block text-gray-700 text-sm font-bold mb-2" for="long_url">Paste your long URL</label>
                    <input class="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                        id="long_url" type="url" placeholder="http://example.com/example1/" />
                </div>
                <div className='flex flex-row my-5 items-center justify-center'>
                    <span className='ml-0 mr-3'>
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="long_url">Choose your domain</label>
                        <input class="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="long_url" type="url" placeholder="https://shorten/" readOnly />
                    </span>
                    <span className='ml-3 mr-0'>
                        <label class="block text-gray-700 text-sm font-bold mb-2" for="long_url">Enter back half</label>
                        <input class="shadow appearance-none border rounded-xl w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            id="long_url" type="url" placeholder="(optional)" />
                    </span>
                </div>
                <div className='flex justify-center'>
                    <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 my-2 px-4 rounded-full" onClick={() => {setLink('www.google.com')}}>
                        Get your link
                    </button>
                </div>
                {link && (
                    <div className='flex flex-row'>
                        <input type="text" value={link} readOnly className='shadow appearance-none border w-2/3 mt-5 rounded-xl py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline' />
                        <button class="bg-blue-500 hover:bg-blue-800 active:outline-dashed active:ring active:ring-blue-300 text-white font-bold px-4 mx-5 h-10 mt-5 rounded-md" onClick={() => {navigator.clipboard.writeText(link)}}>Copy</button>
                    </div>
                )}
            </div>

        </div>
    )
}

export default UrlShortenerCard