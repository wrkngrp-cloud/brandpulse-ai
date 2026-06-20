'use client'

import { useRef, useState, useCallback } from 'react'

export type SupportedImageType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
export type SupportedVideoType = 'video/mp4' | 'video/quicktime' | 'video/webm'

export interface MediaAttachment {
  base64:      string
  mediaType:   SupportedImageType
  previewUrl:  string
  fileName:    string
  sizeKb:      number
  isVideo:     boolean
}

const ALLOWED_IMAGE_TYPES: SupportedImageType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const ALLOWED_VIDEO_TYPES: SupportedVideoType[] = ['video/mp4', 'video/quicktime', 'video/webm']
const MAX_IMAGE_BYTES = 10 * 1024 * 1024  // 10 MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200 MB

function extractVideoFrame(file: File): Promise<{ base64: string; previewUrl: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.src = url

    video.onloadeddata = () => {
      video.currentTime = 0
    }

    video.onseeked = () => {
      const canvas = document.createElement('canvas')
      canvas.width  = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) { URL.revokeObjectURL(url); reject(new Error('Canvas not supported')); return }
      ctx.drawImage(video, 0, 0)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      URL.revokeObjectURL(url)
      resolve({
        base64:     dataUrl.split(',')[1],
        previewUrl: dataUrl,
      })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not load video'))
    }
  })
}

export function useMediaUpload() {
  const [media, setMedia]         = useState<MediaAttachment | null>(null)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [extracting, setExtracting] = useState(false)
  const imageInputRef             = useRef<HTMLInputElement>(null)
  const videoInputRef             = useRef<HTMLInputElement>(null)

  const clearMedia = useCallback(() => {
    setMedia(null)
    setMediaError(null)
    if (imageInputRef.current) imageInputRef.current.value = ''
    if (videoInputRef.current) videoInputRef.current.value = ''
  }, [])

  const handleFile = useCallback(async (file: File) => {
    setMediaError(null)
    const isImage = ALLOWED_IMAGE_TYPES.includes(file.type as SupportedImageType)
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type as SupportedVideoType)

    if (!isImage && !isVideo) {
      setMediaError('Unsupported file type. Use JPEG, PNG, WebP, GIF, MP4, MOV, or WebM.')
      return
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setMediaError('Image too large. Max 10 MB.')
      return
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setMediaError('Video too large. Max 200 MB.')
      return
    }

    if (isImage) {
      const reader = new FileReader()
      reader.onload = ev => {
        const dataUrl = ev.target?.result as string
        setMedia({
          base64:     dataUrl.split(',')[1],
          mediaType:  file.type as SupportedImageType,
          previewUrl: dataUrl,
          fileName:   file.name,
          sizeKb:     Math.round(file.size / 1024),
          isVideo:    false,
        })
      }
      reader.readAsDataURL(file)
    } else {
      // Video: extract first frame
      setExtracting(true)
      try {
        const { base64, previewUrl } = await extractVideoFrame(file)
        setMedia({
          base64,
          mediaType:  'image/jpeg',
          previewUrl,
          fileName:   file.name,
          sizeKb:     Math.round(file.size / 1024),
          isVideo:    true,
        })
      } catch {
        setMediaError('Could not extract frame from video. Try a shorter or smaller file.')
      } finally {
        setExtracting(false)
      }
    }
  }, [])

  const handleImageSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleFile(file)
    e.target.value = ''
  }, [handleFile])

  const handleVideoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    await handleFile(file)
    e.target.value = ''
  }, [handleFile])

  return {
    media, setMedia,
    mediaError, setMediaError,
    extracting,
    imageInputRef,
    videoInputRef,
    handleImageSelect,
    handleVideoSelect,
    clearMedia,
  }
}
