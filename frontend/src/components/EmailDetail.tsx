import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from './ui/use-toast';
import { API_BASE_URL } from '../config';
import { MailboxContext } from '../contexts/MailboxContext';

interface EmailDetailProps {
  emailId: string;
  onClose: () => void;
}

interface Attachment {
  id: string;
  emailId: string;
  filename: string;
  mimeType: string;
  size: number;
  createdAt: number;
  isLarge: boolean;
  chunksCount: number;
}

const EmailDetail: React.FC<EmailDetailProps> = ({ emailId, onClose }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { emailCache, addToEmailCache, handleMailboxNotFound } = useContext(MailboxContext);
  const [email, setEmail] = useState<Email | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);
  
  useEffect(() => {
    const fetchEmail = async () => {
      try {
        // 首先检查缓存中是否有该邮件
        if (emailCache[emailId]) {
          setEmail(emailCache[emailId].email);
          setAttachments(emailCache[emailId].attachments);
          setIsLoading(false);
          return;
        }
        
        setIsLoading(true);
        const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`);
        
        if (!response.ok) {
          // 如果邮箱不存在（404），则清除本地缓存并创建新邮箱
          if (response.status === 404) {
            await handleMailboxNotFound();
            onClose(); // 关闭邮件详情
            return;
          }
          throw new Error('Failed to fetch email');
        }
        
        const data = await response.json();
        if (data.success) {
          setEmail(data.email);
          
          // 如果邮件有附件，获取附件列表
          if (data.email.hasAttachments) {
            await fetchAttachments(emailId, data.email);
          } else {
            // 没有附件，将邮件添加到缓存
            addToEmailCache(emailId, data.email, []);
          }
        } else {
          throw new Error(data.error || 'Unknown error');
        }
      } catch (error) {
        toast({
          title: t('errors.generic'),
          description: t('email.fetchFailed'),
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchEmail();
  }, [emailId, t, toast, emailCache, addToEmailCache, handleMailboxNotFound, onClose]);
  
  const fetchAttachments = async (emailId: string, emailData?: Email) => {
    try {
      setIsLoadingAttachments(true);
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}/attachments`);
      
      if (!response.ok) {
        // 如果邮箱不存在（404），则清除本地缓存并创建新邮箱
        if (response.status === 404) {
          await handleMailboxNotFound();
          onClose(); // 关闭邮件详情
          return;
        }
        throw new Error('Failed to fetch attachments');
      }
      
      const data = await response.json();
      if (data.success) {
        setAttachments(data.attachments);
        
        // 将邮件和附件添加到缓存
        if (emailData) {
          addToEmailCache(emailId, emailData, data.attachments);
        }
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('Error fetching attachments:', error);
    } finally {
      setIsLoadingAttachments(false);
    }
  };
  
  const handleDelete = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/emails/${emailId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete email');
      }
      
      const data = await response.json();
      if (data.success) {
        toast({
          title: t('common.success'),
          description: t('email.deleteSuccess'),
        });
        onClose();
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error) {
      toast({
        title: t('errors.generic'),
        description: t('email.deleteFailed'),
        variant: 'destructive',
      });
    }
  };
  
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };
  
  // 格式化文件大小
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  // 判断文件类型
  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.includes('text/')) return 'text';
    return 'file';
  };
  
  // 获取文件图标
  const getFileIcon = (mimeType: string): string => {
    const fileType = getFileType(mimeType);
    switch (fileType) {
      case 'image': return 'fa-file-image';
      case 'video': return 'fa-file-video';
      case 'audio': return 'fa-file-audio';
      case 'pdf': return 'fa-file-pdf';
      case 'text': return 'fa-file-alt';
      default: return 'fa-file';
    }
  };
  
  // 获取附件下载链接
  const getAttachmentUrl = (attachmentId: string, download: boolean = false): string => {
    return `${API_BASE_URL}/api/attachments/${attachmentId}${download ? '?download=true' : ''}`;
  };
  
  // 渲染附件预览
  const renderAttachmentPreview = (attachment: Attachment) => {
    const fileType = getFileType(attachment.mimeType);
    const attachmentUrl = getAttachmentUrl(attachment.id, true);
    
    switch (fileType) {
      case 'image':
        return (
          <div className="mt-2 max-w-full overflow-hidden">
            <img 
              src={attachmentUrl} 
              alt={attachment.filename} 
              className="max-w-full max-h-[300px] object-contain rounded border"
            />
          </div>
        );
      case 'video':
        return (
          <div className="mt-2">
            <video 
              src={attachmentUrl} 
              controls 
              className="max-w-full max-h-[300px] rounded border"
            >
              {t('email.videoNotSupported')}
            </video>
          </div>
        );
      case 'audio':
        return (
          <div className="mt-2">
            <audio 
              src={attachmentUrl} 
              controls 
              className="w-full"
            >
              {t('email.audioNotSupported')}
            </audio>
          </div>
        );
      case 'pdf':
        return (
          <div className="mt-2">
            <iframe 
              src={attachmentUrl} 
              className="w-full h-[400px] border rounded"
              title={attachment.filename}
            />
          </div>
        );
      default:
        return null;
    }
  };
  
  if (isLoading) {
    return (
      <div className="p-4 bg-muted/20">
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }
  
  if (!email) {
    return (
      <div className="p-4 bg-muted/20">
        <div className="flex justify-center items-center py-8">
          <p className="text-muted-foreground">{t('email.notFound')}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-muted/20">
      <div className="p-4 border-b flex justify-between items-center">
        <h2 className="text-lg font-semibold truncate">
          {email.subject || t('email.noSubject')}
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={onClose}
            className="p-2 rounded-md hover:bg-muted"
            aria-label={t('common.back')}
            title={t('common.close')}
          >
            <i className="fas fa-times text-sm"></i>
          </button>
          <button
            onClick={handleDelete}
            className="p-2 rounded-md hover:bg-muted text-destructive"
            aria-label={t('common.delete')}
            title={t('common.delete')}
          >
            <i className="fas fa-trash-alt text-sm"></i>
          </button>
        </div>
      </div>
      
      <div className="p-4 border-b">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start">
          <div>
            <p className="font-semibold">{t('email.from')}: {email.fromName || email.fromAddress}</p>
            <p className="text-sm text-muted-foreground">{email.fromAddress}</p>
          </div>
          <p className="text-sm text-muted-foreground mt-2 md:mt-0">
            {formatDate(email.receivedAt)}
          </p>
        </div>
        <p className="mt-2">
          <span className="font-semibold">{t('email.to')}: </span>
          {email.toAddress}
        </p>
      </div>
      
      <div className="p-4 max-h-[500px] overflow-auto">
        {email.htmlContent ? (
          <div 
            className="prose max-w-none"
            dangerouslySetInnerHTML={{ __html: email.htmlContent }}
          />
        ) : email.textContent ? (
          <pre className="whitespace-pre-wrap font-sans">{email.textContent}</pre>
        ) : (
          <p className="text-muted-foreground text-center py-4">
            {t('email.noContent')}
          </p>
        )}
      </div>
      
      {email.hasAttachments && (
        <div className="p-4 border-t">
          <h3 className="font-semibold mb-2">{t('email.attachments')}</h3>
          
          {isLoadingAttachments ? (
            <div className="flex justify-center items-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t('email.noAttachments')}
            </p>
          ) : (
            <div className="space-y-4">
              {attachments.map((attachment) => (
                <div key={attachment.id} className="border rounded-md p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <i className={`fas ${getFileIcon(attachment.mimeType)} text-xl text-primary`}></i>
                      <div>
                        <p className="font-medium">{attachment.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {attachment.mimeType} • {formatFileSize(attachment.size)}
                        </p>
                      </div>
                    </div>
                    <a 
                      href={getAttachmentUrl(attachment.id, true)}
                      download={attachment.filename}
                      className="p-2 rounded-md hover:bg-muted text-primary"
                      title={t('email.download')}
                    >
                      <i className="fas fa-download"></i>
                    </a>
                  </div>
                  
                  {/* 附件预览 */}
                  {renderAttachmentPreview(attachment)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailDetail; 