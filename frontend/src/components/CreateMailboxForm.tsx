import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ui/use-toast';

interface CreateMailboxFormProps {
  onMailboxCreated: (address: string) => void;
}

const CreateMailboxForm: React.FC<CreateMailboxFormProps> = ({ onMailboxCreated }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isCustom, setIsCustom] = useState(false);
  const [customAddress, setCustomAddress] = useState('');
  const expiresInHours = 24;
  const [isLoading, setIsLoading] = useState(false);
  
  const handleCreateRandom = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/mailboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          expiresInHours,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create mailbox');
      }
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: t('common.success'),
          description: t('mailbox.createSuccess'),
        });
        onMailboxCreated(data.mailbox.address);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: t('mailbox.createFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleCreateCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customAddress.trim()) {
      toast({
        title: t('errors.validation'),
        description: t('mailbox.invalidAddress'),
        variant: 'destructive',
      });
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/mailboxes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: customAddress.trim(),
          expiresInHours,
        }),
      });
      
      if (!response.ok) {
        if (response.status === 400) {
          toast({
            title: t('errors.validation'),
            description: t('mailbox.addressExists'),
            variant: 'destructive',
          });
          return;
        }
        throw new Error('Failed to create mailbox');
      }
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: t('common.success'),
          description: t('mailbox.createSuccess'),
        });
        onMailboxCreated(data.mailbox.address);
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: t('mailbox.createFailed'),
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="border rounded-lg p-6">
      <div className="flex mb-6">
        <button
          type="button"
          className={`flex-1 py-2 px-4 rounded-l-md ${
            !isCustom ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
          onClick={() => setIsCustom(false)}
        >
          {t('mailbox.createRandom')}
        </button>
        <button
          type="button"
          className={`flex-1 py-2 px-4 rounded-r-md ${
            isCustom ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}
          onClick={() => setIsCustom(true)}
        >
          {t('mailbox.createCustom')}
        </button>
      </div>
      

    </div>
  );
};

export default CreateMailboxForm; 