import ProductPage from './ProductPage'

export default function Page() {
  const isAssistantEnabled = !!process.env.OPENAI_API_KEY
  return <ProductPage isAssistantEnabled={isAssistantEnabled} />
}
