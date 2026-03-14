import ProductPage from './ProductPage'

export default function Page() {
  const isAssistantEnabled = !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
  return <ProductPage isAssistantEnabled={isAssistantEnabled} />
}
