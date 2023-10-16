import './App.css';
import UrlShortenerCard from './Components/UrlShortenerCard';

function App() {
  return (
    <div className="bg-cyan-300 w-full h-screen flex justify-center flex-col items-center">
      <p className='text-5xl font-sans font-bold text-white drop-shadow-lg mb-20'>Shorten it!</p>
      <UrlShortenerCard />
      <p className='text-white mt-16 text-lg drop-shadow-sm'>&copy; Advait Gogte</p>
    </div>
  );
}

export default App;
