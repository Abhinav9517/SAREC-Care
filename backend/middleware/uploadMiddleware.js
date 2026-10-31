const multer = require('multer')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')

const uploadRoot = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '..', 'private-uploads'))
fs.mkdirSync(uploadRoot, { recursive: true })
const allowed = new Set((process.env.UPLOAD_ALLOWED_TYPES || 'image/jpeg,image/png,image/webp,video/mp4,video/webm').split(',').map((type) => type.trim()))
const maxBytes = Number(process.env.UPLOAD_MAX_FILE_BYTES || 20 * 1024 * 1024)
const maxFiles = Math.min(10, Math.max(1, Number.parseInt(process.env.UPLOAD_MAX_FILES || '5', 10) || 5))
const storage = multer.diskStorage({ destination: uploadRoot, filename: (_req, _file, done) => done(null, `${crypto.randomUUID()}.bin`) })
const upload = multer({ storage, limits: { fileSize: maxBytes, files: maxFiles }, fileFilter: (_req, file, done) => allowed.has(file.mimetype) ? done(null, true) : done(new Error('Unsupported file type')) })
const cleanupFiles = (files = []) => files.forEach((file) => file?.path && fs.unlink(file.path, () => {}))
const uploadFiles = (fieldName, single = false) => (req, res, next) => {
  const parser = single ? upload.single(fieldName) : upload.array(fieldName, maxFiles)
  parser(req, res, (error) => {
    if (error) cleanupFiles([...(req.files || []), ...(req.file ? [req.file] : [])])
    next(error)
  })
}
const verifyUploadedFiles = (req, res, next) => {
  const files = [...(req.files || []), ...(req.file ? [req.file] : [])]
  try {
    for (const file of files) {
      const bytes = fs.readFileSync(file.path)
      const valid = file.mimetype === 'image/jpeg' ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : file.mimetype === 'image/png' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : file.mimetype === 'image/webp' ? bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
            : file.mimetype === 'video/mp4' ? bytes.toString('ascii', 4, 8) === 'ftyp'
              : file.mimetype === 'video/webm' ? bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) : false
      if (!valid) {
        cleanupFiles(files)
        return res.status(400).json({ success: false, message: `File content does not match its declared type: ${file.originalname}` })
      }
    }
    return next()
  } catch (error) {
    cleanupFiles(files)
    return next(error)
  }
}
module.exports = { upload, uploadFiles, uploadRoot, allowed, maxBytes, maxFiles, verifyUploadedFiles, cleanupFiles }
