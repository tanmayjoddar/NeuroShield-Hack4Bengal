import React from "react";
import { useNavigate } from "react-router-dom";
import TransactionLogsViewer from "@/components/TransactionLogsViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LogsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto py-8 px-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="border-white/10 bg-white/5 hover:bg-white/10 text-white"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-3xl font-bold text-white">
            Transaction Security Logs
          </h1>
        </div>
        <TransactionLogsViewer />
      </div>
    </div>
  );
};

export default LogsPage;
