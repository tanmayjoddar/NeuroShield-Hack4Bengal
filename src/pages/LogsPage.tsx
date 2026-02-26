import React from "react";
import { useNavigate } from "react-router-dom";
import TransactionLogsViewer from "@/components/TransactionLogsViewer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const LogsPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto py-8 max-w-3xl">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Transaction Security Logs</h1>
      </div>
      <TransactionLogsViewer />
    </div>
  );
};

export default LogsPage;
