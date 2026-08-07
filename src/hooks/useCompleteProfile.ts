import { useState, useEffect } from "react";
import { driverApi, VerifiedEquipment } from "@/lib/api";  

export function useCompleteProfile() {
    const [equipmentHistory, setEquipmentHistory] = useState<VerifiedEquipment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const fetchProfile = async () => {
            try {
                setIsLoading(true);
                const response = await driverApi.getCompleteProfile();

                if (isMounted && response.ok) {
                    setEquipmentHistory(response.data.data.verified_equipment_history || []);
                }
            } catch (err: any) {
                if (isMounted) {
                    setError(err.message || "Failed to fetch equipment history.");
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        fetchProfile();

        return () => {
            isMounted = false;
        };
    }, []); 

    return { equipmentHistory, isLoading, error };
}