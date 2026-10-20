export default function LoadingScreen({ message = 'Carregando ContratoIA...' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
