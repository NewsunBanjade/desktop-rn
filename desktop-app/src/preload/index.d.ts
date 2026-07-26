import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    api: {
      getEnv: () => {
        SUPABASE_URL?: string
        SUPABASE_PUBLISHABLE_KEY?: string
        SUPABASE_SECRET_KEY?: string
        CLOUDFLARE_R2_BUCKET_NAME?: string
        CLOUDFLARE_R2_ACCOUNT_ID?: string
        CLOUDFLARE_R2_ACCESS_KEY_ID?: string
        CLOUDFLARE_R2_SECRET_ACCESS_KEY?: string
        CLOUDFLARE_R2_PUBLIC_URL?: string
        CLOUDFLARE_R2_S3_ENDPOINT?: string
        CLOUDFLARE_API_TOKEN?: string
        IS_PACKAGED?: boolean
        USER_DATA_PATH?: string
        EXE_DIR_PATH?: string
      }
      uploadToR2: (
        fileName: string,
        fileBuffer: ArrayBuffer | null,
        contentType: string,
        filePath?: string
      ) => Promise<string>
      deleteFromR2: (key: string) => Promise<boolean>
      generateThumbnail: (args: {
        filePath: string
        fileBuffer: ArrayBuffer | null
      }) => Promise<Uint8Array>
      getR2BucketUsage: () => Promise<{
        payloadSize: number
        objectCount: number
        configured?: boolean
        error?: string
      }>
      writeLog: (level: 'info' | 'error' | 'warn', message: string, data?: unknown) => void
      writePendingStatus: (pendingList: unknown) => void
      supabaseInsertPhoto: (photoPayload: unknown) => Promise<Record<string, unknown>>
      saveR2Config: (config: {
        accountId: string
        bucketName: string
        publicUrl: string
        accessKeyId: string
        secretAccessKey: string
        apiToken: string
        supabaseSecretKey: string
      }) => Promise<{ success: boolean }>
      getR2Config: () => Promise<{
        configured: boolean
        accountId?: string
        bucketName?: string
        publicUrl?: string
        hasAccessKeyId?: boolean
        hasSecretAccessKey?: boolean
        hasApiToken?: boolean
        hasSupabaseSecretKey?: boolean
      }>
    }
  }
}
