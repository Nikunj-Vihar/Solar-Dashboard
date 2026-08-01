import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function LogLoading() {
  return (
    <div className="mx-auto max-w-3xl pb-24 md:grid md:grid-cols-[280px_1fr] md:gap-6">
      <div className="hidden md:block">
        <Skeleton className="h-80 w-full" />
      </div>
      <div className="mx-auto w-full max-w-lg md:mx-0 md:max-w-none">
        <div className="mb-4 flex items-center justify-between">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-4">
                <Skeleton className="h-4 w-24" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-9 w-full" />
                  <Skeleton className="h-9 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
