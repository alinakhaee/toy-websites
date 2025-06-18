import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'

interface Photo {
  id: string
  url: string
  width: number
  height: number
  title: string
  color: string
  loaded?: boolean
}

interface PicsumPhoto {
  id: string;
  author: string;
  width: number;
  height: number;
  url: string;
  download_url: string;
}

interface ConnectionInfo {
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g'
  saveData?: boolean
  downlink?: number
  rtt?: number
  addEventListener?: (type: string, listener: () => void) => void
  removeEventListener?: (type: string, listener: () => void) => void
}

interface NavigatorWithConnection extends Navigator {
  connection?: ConnectionInfo
  mozConnection?: ConnectionInfo
  webkitConnection?: ConnectionInfo
}

const PHOTO_TITLES = [
  'Sunset Dreams', 'Ocean Waves', 'Mountain Peak', 'City Lights', 'Forest Path', 'Desert Dunes',
  'Golden Hour', 'Blue Skies', 'Neon Nights', 'Wildflowers', 'Urban Jungle', 'Crystal Lake',
  'Misty Morning', 'Starry Night', 'Rainbow Bridge', 'Autumn Leaves', 'Spring Bloom', 'Winter Wonder'
]

const BACKGROUND_COLORS = [
  'bg-blue-500', 'bg-yellow-400', 'bg-pink-500', 'bg-green-500', 'bg-purple-500', 'bg-red-500',
  'bg-indigo-500', 'bg-orange-500', 'bg-teal-500', 'bg-rose-500'
]

const ITEMS_PER_PAGE = 20
const INTERSECTION_THRESHOLD = 0.1
const LOADING_DELAY = 600

const ImageGallery: React.FC = () => {
  // Core state
  const [photos, setPhotos] = useState<Photo[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [totalPages, setTotalPages] = useState(1)
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]) // Store all photos for pagination
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  // Layout state
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth)
  const [columnCount, setColumnCount] = useState(4)
  const [viewportWidth, setViewportWidth] = useState(window.innerWidth)
  const [viewportHeight, setViewportHeight] = useState(window.innerHeight)
  
  // Connection and performance state
  const [connectionSpeed, setConnectionSpeed] = useState<'fast' | 'slow'>('fast')
  const [isSlowConnection, setIsSlowConnection] = useState(false)
  const [loadingStrategy, setLoadingStrategy] = useState<'infinite-scroll' | 'load-more' | 'pagination'>('infinite-scroll');
  
  // UI state
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null)
  const [isLoadMoreHovered, setIsLoadMoreHovered] = useState(false)
  const [downloadingPhotoId, setDownloadingPhotoId] = useState<string | null>(null)
  
  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const observerTargetRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const intersectionObserverRef = useRef<IntersectionObserver | null>(null)

  const handleImageLoad = useCallback((photoId: string) => {
    const updateLoadedFlag = (p: Photo) => p.id === photoId ? { ...p, loaded: true } : p;
    setPhotos(prev => prev.map(updateLoadedFlag));
    if (loadingStrategy === 'pagination') {
      setAllPhotos(prev => prev.map(updateLoadedFlag));
    }
  }, [loadingStrategy]);

  // Generate photos with better randomization
  const generatePhotos = useCallback(async (page: number, count: number = ITEMS_PER_PAGE): Promise<Photo[]> => {
    try {
      const response = await fetch(`https://picsum.photos/v2/list?page=${page}&limit=${count}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const picsumPhotos: PicsumPhoto[] = await response.json();
      
      return picsumPhotos.map((p) => {
        const desiredWidth = 500 + Math.floor(Math.random() * 300);
        const aspectRatio = p.width / p.height;
        const desiredHeight = Math.round(desiredWidth / aspectRatio);
        
        const titleIndex = Math.floor(Math.random() * PHOTO_TITLES.length);
        const colorIndex = Math.floor(Math.random() * BACKGROUND_COLORS.length);
        
        return {
          id: p.id,
          url: `https://picsum.photos/id/${p.id}/${desiredWidth}/${desiredHeight}`,
          width: desiredWidth,
          height: desiredHeight,
          title: PHOTO_TITLES[titleIndex],
          color: BACKGROUND_COLORS[colorIndex],
          loaded: false
        };
      });
    } catch (error) {
        console.error("Could not fetch photos from Picsum API:", error);
        setHasError(true);
        return [];
    }
  }, []);

  // Enhanced connection speed detection
  const detectConnectionSpeed = useCallback(() => {
    const nav = navigator as NavigatorWithConnection
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection
    
    if (connection) {
      const slowTypes = ['slow-2g', '2g', '3g']
      const isSlowType = connection.effectiveType && slowTypes.includes(connection.effectiveType)
      const isSaveDataEnabled = connection.saveData === true
      const isSlowDownlink = connection.downlink && connection.downlink < 1.5
      const isHighRTT = connection.rtt && connection.rtt > 300
      
      const isSlowConnectionDetected = Boolean(isSlowType || isSaveDataEnabled || isSlowDownlink || isHighRTT)
      
      setConnectionSpeed(isSlowConnectionDetected ? 'slow' : 'fast')
      setIsSlowConnection(isSlowConnectionDetected)
      
      return isSlowConnectionDetected ? 'slow' : 'fast'
    }
    
    // Default to fast if no connection info available
    setConnectionSpeed('fast')
    setIsSlowConnection(false)
    return 'fast'
  }, [])

  // Enhanced viewport and orientation detection
  const updateViewportInfo = useCallback(() => {
    const width = window.innerWidth
    const height = window.innerHeight
    const portrait = height > width
    
    setViewportWidth(width)
    setViewportHeight(height)
    setIsPortrait(portrait)
    
    // Update column count based on container width
    if (containerRef.current) {
      const containerWidth = containerRef.current.offsetWidth
      let columns = 1
      
      if (containerWidth >= 1536) columns = 6      // 2xl
      else if (containerWidth >= 1280) columns = 5 // xl
      else if (containerWidth >= 1024) columns = 4 // lg
      else if (containerWidth >= 768) columns = 3  // md
      else if (containerWidth >= 640) columns = 2  // sm
      else columns = 1                            // xs
      
      setColumnCount(columns)
    }
    
    // Determine loading strategy based on device and connection
    const speed = detectConnectionSpeed()
    const isDesktop = !portrait
    const isFastConnection = speed === 'fast'
    
    let strategy: 'infinite-scroll' | 'load-more' | 'pagination';
    if (isDesktop) {
      if (isFastConnection) {
        strategy = 'infinite-scroll';
      } else {
        strategy = 'load-more';
      }
    } else {
      strategy = 'pagination';
    }
    setLoadingStrategy(strategy);
  }, [detectConnectionSpeed])

  // Load more photos for infinite scroll or load-more button
  const loadMorePhotos = useCallback(async () => {
    if (isLoading) return
    
    try {
      setIsLoading(true)
      setHasError(false)
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, LOADING_DELAY))
      
      const newPhotos = await generatePhotos(currentPage)
      setPhotos(prevPhotos => [...prevPhotos, ...newPhotos])
      setCurrentPage(prevPage => prevPage + 1)
    } catch (error) {
      console.error('Failed to load photos:', error)
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [currentPage, isLoading, generatePhotos])

  // Load specific page for pagination (mobile)
  const loadPage = useCallback(async (page: number) => {
    if (isLoading) return
    
    try {
      setIsLoading(true)
      setHasError(false)
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, LOADING_DELAY))
      
      // Check if we already have photos for this page
      const startIndex = (page - 1) * ITEMS_PER_PAGE
      const endIndex = startIndex + ITEMS_PER_PAGE
      
      if (allPhotos.length < endIndex) {
        // Generate more photos if needed
        const currentMaxPage = Math.floor(allPhotos.length / ITEMS_PER_PAGE);
        const pagesToFetch = [];
        for (let i = currentMaxPage + 1; i <= page; i++) {
          pagesToFetch.push(i);
        }

        const newPhotosPromises = pagesToFetch.map(p => generatePhotos(p));
        const newPhotosArrays = await Promise.all(newPhotosPromises);
        const flattenedNewPhotos = newPhotosArrays.flat();
        
        const updatedAllPhotos = [...allPhotos, ...flattenedNewPhotos];
        setAllPhotos(updatedAllPhotos);

        const pagePhotos = updatedAllPhotos.slice(startIndex, endIndex);
        setPhotos(pagePhotos);
      } else {
        // Use existing photos for this page
        const pagePhotos = allPhotos.slice(startIndex, endIndex)
        setPhotos(pagePhotos)
      }
      
      setCurrentPage(page)
      
      // Calculate total pages (assume we can load indefinitely, show up to current + 2)
      const newTotalPages = Math.max(totalPages, page + 2)
      setTotalPages(newTotalPages)
      
    } catch (error) {
      console.error('Failed to load page:', error)
      setHasError(true)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, generatePhotos, allPhotos, totalPages])

  // Go to next page
  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      loadPage(currentPage + 1)
    }
  }, [currentPage, totalPages, loadPage])

  // Go to previous page
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      loadPage(currentPage - 1)
    }
  }, [currentPage, loadPage])

  // Go to specific page
  const goToPage = useCallback((page: number) => {
    if (page >= 1 && page <= totalPages) {
      loadPage(page)
    }
  }, [loadPage, totalPages])

  // Enhanced intersection observer setup
  const setupIntersectionObserver = useCallback(() => {
    if (intersectionObserverRef.current) {
      intersectionObserverRef.current.disconnect()
    }
    
    if (!loadingStrategy || !observerTargetRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !isLoading && !hasError) {
          loadMorePhotos()
        }
      },
      {
        threshold: INTERSECTION_THRESHOLD,
        rootMargin: '50px'
      }
    )
    
    observer.observe(observerTargetRef.current)
    intersectionObserverRef.current = observer
    
    return () => observer.disconnect()
  }, [loadingStrategy, isLoading, hasError, loadMorePhotos])

  // Initialize viewport and connection detection
  useEffect(() => {
    updateViewportInfo()
    detectConnectionSpeed()
    
    const handleResize = () => updateViewportInfo()
    const handleConnectionChange = () => detectConnectionSpeed()
    
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    
    const nav = navigator as NavigatorWithConnection
    const connection = nav.connection || nav.mozConnection || nav.webkitConnection
    if (connection) {
      connection.addEventListener?.('change', handleConnectionChange)
    }
    
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
      if (connection) {
        connection.removeEventListener?.('change', handleConnectionChange)
      }
    }
  }, [updateViewportInfo, detectConnectionSpeed])

  // Setup intersection observer
  useEffect(() => {
    const cleanup = setupIntersectionObserver()
    return cleanup
  }, [setupIntersectionObserver])

  // Track mouse movement for dynamic background
  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.pageX, y: event.pageY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Reset photos when search or loading strategy changes
  useEffect(() => {
    setPhotos([])
    setAllPhotos([])
    setCurrentPage(1)
    setTotalPages(1)
    setHasError(false)
    
    // Load initial photos/page after a short delay
    const timer = setTimeout(() => {
      if (loadingStrategy === 'pagination') {
        loadPage(1);
      } else {
        loadMorePhotos();
      }
    }, 100)
    
    return () => clearTimeout(timer)
  }, [searchQuery, loadingStrategy]) // eslint-disable-line react-hooks/exhaustive-deps

  // Filter photos based on search query
  const filteredPhotos = useMemo(() => {
    if (!searchQuery.trim()) return photos
    
    const query = searchQuery.toLowerCase().trim()
    return photos.filter(photo =>
      photo.title.toLowerCase().includes(query)
    )
  }, [photos, searchQuery])

  // Organize photos into columns using masonry layout
  const photoColumns = useMemo(() => {
    const columns: Photo[][] = Array.from({ length: columnCount }, () => [])
    const isSearchActive = searchQuery.trim() !== '';

    if (isSearchActive) {
      // For search results, distribute photos sequentially for a more ordered grid
      filteredPhotos.forEach((photo, index) => {
        columns[index % columnCount].push(photo);
      });
    } else {
      // Original masonry layout for browsing
      const columnHeights = new Array(columnCount).fill(0)
      
      filteredPhotos.forEach(photo => {
        // Find column with minimum height
        const shortestColumnIndex = columnHeights.indexOf(Math.min(...columnHeights))
        columns[shortestColumnIndex].push(photo)
        
        // Update column height (approximate aspect ratio)
        columnHeights[shortestColumnIndex] += photo.height / photo.width
      })
    }
    
    return columns
  }, [filteredPhotos, columnCount, searchQuery])

  // Enhanced download function with better error handling
  const downloadPhoto = async (url: string, title: string, photoId: string) => {
    setDownloadingPhotoId(photoId)
    
    try {
      const response = await fetch(url, { 
        mode: 'cors',
        headers: {
          'Accept': 'image/*'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `${title.replace(/\s+/g, '-').toLowerCase()}.jpg`
      
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      window.URL.revokeObjectURL(blobUrl)
    } catch (error) {
      console.error('Download failed:', error)
      alert('Download failed. This image may not be downloadable due to CORS restrictions or network issues.')
    } finally {
      setDownloadingPhotoId(null)
    }
  }

  // Load Google Fonts
  useEffect(() => {
    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap'
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    
    document.body.classList.add('font-poppins')
    
    return () => {
      document.body.classList.remove('font-poppins')
      if (document.head.contains(link)) {
        document.head.removeChild(link)
      }
    }
  }, [])

  // Pagination component
  const PaginationControls = () => {
    const renderPageNumbers = () => {
      const pages = []
      const startPage = Math.max(1, currentPage - 2)
      const endPage = Math.min(totalPages, currentPage + 2)
      
      // Previous button
      pages.push(
        <button
          key="prev"
          onClick={goToPreviousPage}
          disabled={currentPage === 1}
          className={`
            px-3 py-2 rounded-lg font-medium transition-all duration-200
            ${currentPage === 1 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 shadow-sm'
            }
          `}
        >
          ‹ Prev
        </button>
      )
      
      // Page numbers
      for (let i = startPage; i <= endPage; i++) {
        pages.push(
          <button
            key={i}
            onClick={() => goToPage(i)}
            className={`
              px-3 py-2 rounded-lg font-medium transition-all duration-200
              ${i === currentPage
                ? 'bg-blue-500 text-white shadow-md'
                : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 shadow-sm'
              }
            `}
          >
            {i}
          </button>
        )
      }
      
      // Next button
      pages.push(
        <button
          key="next"
          onClick={goToNextPage}
          disabled={currentPage === totalPages}
          className={`
            px-3 py-2 rounded-lg font-medium transition-all duration-200
            ${currentPage === totalPages 
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
              : 'bg-white text-gray-700 hover:bg-blue-50 hover:text-blue-600 shadow-sm'
            }
          `}
        >
          Next ›
        </button>
      )
      
      return pages
    }
    
    return (
      <div className="flex flex-col items-center space-y-4 mt-12">
        <div className="flex items-center space-x-2">
          {renderPageNumbers()}
        </div>
        <div className="text-sm text-gray-500">
          Page {currentPage} of {totalPages} • {filteredPhotos.length} images
        </div>
      </div>
    )
  }

  return (
    <div 
      className="min-h-screen pb-12 font-poppins"
      style={{
        background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, #fef9c3, #bfdbfe)`
      }}
    >
      {/* Hero Section with Search */}
      <div className="w-full h-72 md:h-96 relative mb-8 rounded-none md:rounded-2xl overflow-hidden shadow-lg">
        <img
          src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80"
          alt="Modern cityscape"
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div className="absolute inset-0 bg-black/30" />
        
        <div className="absolute left-1/2 top-2/3 w-11/12 sm:w-4/5 md:w-3/5 lg:w-1/2 transform -translate-x-1/2 -translate-y-1/2 z-10">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search for amazing images..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              className={`
                w-full py-4 px-6 pr-14 text-lg rounded-2xl
                bg-white/70 backdrop-blur-lg border-2
                border-white/40 focus:border-blue-400/50
                shadow-lg focus:shadow-xl
                font-medium text-gray-800 placeholder-gray-500
                transition-all duration-300 ease-out
                ${isSearchFocused ? 'bg-white/85 scale-105' : ''}
              `}
              style={{ fontFamily: 'Poppins, sans-serif' }}
            />
            <div className="absolute right-5 top-1/2 -translate-y-1/2">
              <svg
                className="w-6 h-6 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2.5}
                  d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" 
                />
              </svg>
            </div>
          </div>
          
          {/* Connection and layout info */}
          <div className="mt-5 flex justify-center items-center flex-wrap gap-4 text-base text-white/90 font-medium">
            <span className="bg-black/30 px-4 py-2 rounded-full backdrop-blur-md flex items-center space-x-2">
              <span>{isPortrait ? '📱' : '🖥️'}</span>
              <span>{isPortrait ? 'Mobile' : 'Desktop'}</span>
            </span>
            <span className="bg-black/30 px-4 py-2 rounded-full backdrop-blur-md flex items-center space-x-2">
              <span>{connectionSpeed === 'fast' ? '⚡' : '🐌'}</span>
              <span>{connectionSpeed === 'fast' ? 'Fast' : 'Slow'} Connection</span>
            </span>
            <span className="bg-black/30 px-4 py-2 rounded-full backdrop-blur-md flex items-center space-x-2">
              <span>{loadingStrategy === 'infinite-scroll' ? '∞' : (loadingStrategy === 'load-more' ? '🖱️' : '📄')}</span>
              <span>{loadingStrategy === 'infinite-scroll' ? 'Auto Load' : (loadingStrategy === 'load-more' ? 'Load More' : 'Pagination')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Photo Grid */}
      <div
        ref={containerRef}
        className={`
          max-w-7xl mx-auto px-3 md:px-6
          ${columnCount === 1 ? 'flex flex-col gap-4' : 'flex gap-3 md:gap-4'}
        `}
      >
        {photoColumns.map((column, columnIndex) => (
          <div key={columnIndex} className="flex flex-col gap-3 md:gap-4 flex-1">
            {column.map((photo) => (
              <div
                key={photo.id}
                style={{ aspectRatio: `${photo.width} / ${photo.height}` }}
                className={`
                  group relative rounded-xl overflow-hidden
                  shadow-lg bg-white/60 backdrop-blur-md
                  transition-all duration-300 ease-out
                  hover:-translate-y-2 hover:shadow-2xl
                  cursor-pointer border border-white/20
                  ${hoveredPhotoId === photo.id ? 'ring-2 ring-yellow-400' : ''}
                `}
                onMouseEnter={() => setHoveredPhotoId(photo.id)}
                onMouseLeave={() => setHoveredPhotoId(null)}
              >
                {/* Skeleton Loader */}
                {!photo.loaded && (
                  <div className="absolute inset-0 bg-gray-300 animate-pulse" />
                )}

                <img
                  src={photo.url}
                  alt={photo.title}
                  className={`w-full h-full object-cover block transition-opacity duration-500 group-hover:scale-105 ${!photo.loaded ? 'opacity-0' : 'opacity-100'}`}
                  loading="lazy"
                  onLoad={() => handleImageLoad(photo.id)}
                />
                
                {/* Download Button */}
                <div className={`
                  absolute top-4 right-4
                  transition-all duration-300 ease-in-out
                  ${hoveredPhotoId === photo.id && photo.loaded ? 'translate-y-0 opacity-100' : '-translate-y-4 opacity-0'}
                `}>
                  <button
                    className={`
                      h-12 rounded-full bg-white/80 backdrop-blur-lg
                      flex items-center justify-center font-semibold text-gray-900
                      shadow-md hover:shadow-lg hover:bg-white
                      transition-all duration-300 ease-in-out
                      w-12 group-hover:w-40
                      focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-opacity-75
                      ${downloadingPhotoId === photo.id ? 'w-12 cursor-not-allowed' : ''}
                    `}
                    onClick={() => downloadPhoto(photo.url, photo.title, photo.id)}
                    disabled={downloadingPhotoId === photo.id}
                    aria-label={`Download ${photo.title}`}
                  >
                    {downloadingPhotoId === photo.id ? (
                      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <div className="flex items-center justify-center overflow-hidden">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        {/* <span className="ml-2 text-base whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-200 delay-150">
                          Download
                        </span> */}
                      </div>
                    )}
                  </button>
                </div>
                
                {/* Photo Info Overlay */}
                <div className={`
                  absolute left-0 right-0 bottom-0 px-4 py-3
                  bg-gradient-to-t from-black/80 via-black/40 to-transparent
                  text-white transition-all duration-300
                  ${hoveredPhotoId === photo.id && photo.loaded ? 'translate-y-0' : 'translate-y-full'}
                `}>
                  <div className="font-semibold text-base mb-1">{photo.title}</div>
                  <div className="text-xs opacity-90 flex items-center space-x-3">
                    <span>{photo.width} × {photo.height}</span>
                    <span>•</span>
                    <span>{((photo.width * photo.height) / 1000000).toFixed(1)}MP</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex justify-center items-center py-12">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="w-6 h-6 bg-blue-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}

      {/* Error State */}
      {hasError && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="text-red-500 text-xl mb-4">⚠️</div>
          <p className="text-gray-600 mb-4">Failed to load images. Please try again.</p>
          <button
            onClick={loadMorePhotos}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Intersection Observer Target (for infinite scroll) */}
      {loadingStrategy === 'infinite-scroll' && (
        <div 
          ref={observerTargetRef} 
          className="h-20 flex items-center justify-center opacity-0"
          aria-hidden="true"
        />
      )}

      {/* Load More Button (for desktop with slow connection) */}
      {loadingStrategy === 'load-more' && !isLoading && !hasError && (
        <div className="flex justify-center mt-12">
          <button
            onClick={loadMorePhotos}
            onMouseEnter={() => setIsLoadMoreHovered(true)}
            onMouseLeave={() => setIsLoadMoreHovered(false)}
            className={`
              px-8 py-3 rounded-2xl font-semibold text-lg
              bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500
              text-white shadow-xl transition-all duration-300
              hover:-translate-y-1 hover:shadow-2xl
              ${isLoadMoreHovered ? 'scale-105 ring-4 ring-blue-300/50' : ''}
              relative overflow-hidden
            `}
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            <span className="relative z-10">Load More Images</span>
            <div className={`
              absolute inset-0 bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500
              transition-opacity duration-300
              ${isLoadMoreHovered ? 'opacity-100' : 'opacity-0'}
            `} />
          </button>
        </div>
      )}

      {/* Pagination Controls (for mobile/slow connections) */}
      {loadingStrategy === 'pagination' && !isLoading && !hasError && filteredPhotos.length > 0 && (
         <PaginationControls />
       )}

      {/* Empty State */}
      {filteredPhotos.length === 0 && !isLoading && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No images found</h3>
          <p className="text-gray-500 mb-4">
            Try searching for different keywords like "sunset", "ocean", or "city"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Show All Images
          </button>
        </div>
      )}
    </div>
  )
}

export default ImageGallery