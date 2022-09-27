import loadImage from 'blueimp-load-image';
import { Logger } from '../logger';
const pdfjsLib = require("pdfjs-dist/legacy/build/pdf.js");

export const THUMBNAIL_WIDTH = 438
export const THUMBNAIL_HEIGHT = 136

const makeImageThumbnail = async (fileUrl: any) => {
  return new Promise((resolve, reject) => {
    const image = document.createElement('img')
    image.setAttribute('src', fileUrl)

    image.addEventListener('load', () => {
      const canvas = (<any>loadImage).scale(image, {
        canvas: true,
        cover: true,
        maxWidth: THUMBNAIL_WIDTH
      })
      canvas.toBlob(
        blob => {
          resolve(blob)
        },
        'image/jpeg',
        1
      )
    })

    image.addEventListener('error', error => {
      Logger.log('Make image thumbnail error')
      Logger.log(error)
      reject(error)
    })
  })
}

const makeVideoThumbnail = async (fileUrl: string) => {
  const canvasUrl = await new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.setAttribute('src', fileUrl)
    video.load()

    video.addEventListener('error', error => {
      Logger.log('Make video thumbnail error')
      Logger.log(error)
      reject('Make video thumbnail error: ' + error)
    })

    video.addEventListener('loadedmetadata', () => {
      // delay seeking or else 'seeked' event won't fire on Safari
      setTimeout(() => {
        video.currentTime = 0.0
      }, 200)

      video.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas')

        canvas.width = video.videoWidth
        canvas.height = video.videoHeight

        canvas
          .getContext('2d')
          .drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL())
      })
    })
  })
  return makeImageThumbnail(canvasUrl)
}

export const makePdfThumbnail = async fileUrl => {
  const defaultWorker = () => {
    if (!pdfjsLib.GlobalWorkerOptions.workerPort) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
      pdfjsLib.GlobalWorkerOptions.workerPort = new pdfjsLib.PDFWorker('default-worker');
    }
    return pdfjsLib.GlobalWorkerOptions.workerPort
  }
  const pdf = await pdfjsLib.getDocument({ url: fileUrl, worker: defaultWorker() }).promise
  const firstPage = await pdf.getPage(1)
  const canvasUrl = await new Promise(resolve => {
    const viewport = firstPage.getViewport({ scale: 1 })
    const canvas = document.createElement('canvas')

    canvas.width = viewport.width
    canvas.height = viewport.height

    firstPage
      .render({
        canvasContext: canvas.getContext('2d'),
        viewport: viewport
      })
      .promise.then(function () {
        resolve(canvas.toDataURL())
      })
  })
  return makeImageThumbnail(canvasUrl)
}

export const createThumbnail = async (file: any) => {
  let thumbnail = null
  // TODO: make it node & browser compatible
  if (typeof window !== 'undefined') {
    const fileUrl = URL.createObjectURL(file)
    switch (file.type) {
      case 'application/pdf':
        try {
          thumbnail = await makePdfThumbnail(fileUrl)
        } catch (error) {
          Logger.log('PDF thumbnail error: ' + error)
        }
        break
      case 'image/jpeg':
      case 'image/jpg':
      case 'image/png':
      case 'image/gif':
        try {
          thumbnail = await makeImageThumbnail(fileUrl)
        } catch (error) {
          Logger.log('Image thumbnail error: ' + error)
        }
        break
      case 'video/mp4':
      case 'video/quicktime':
        try {
          thumbnail = await makeVideoThumbnail(fileUrl)
        } catch (error) {
          Logger.log('Video thumbnail error: ' + error)
        }
        break
      default:
        Logger.log('Thumbnail not supported for this file type: ' + file.type)
        return null;
        break
    }
    URL.revokeObjectURL(fileUrl)
    // converting recieved Blob to File and adding `data` field with ArrayBuffer
    let myFile = <any>new File([thumbnail], `thumb_${file.name}`, { type: thumbnail.type })
    myFile.data = await thumbnail.arrayBuffer();
    return myFile
  }
  return null;
}
