
#import "MyHTTPConnection.h"
#import "HTTPMessage.h"
#import "HTTPDataResponse.h"
#import "DDNumber.h"
#import "HTTPLogging.h"

#import "MultipartFormDataParser.h"
#import "MultipartMessageHeaderField.h"
#import "HTTPDynamicFileResponse.h"
#import "HTTPFileResponse.h"

// Log levels : off, error, warn, info, verbose
// Other flags: trace
static const int httpLogLevel = HTTP_LOG_LEVEL_VERBOSE; // | HTTP_LOG_FLAG_TRACE;


/**
 * All we have to do is override appropriate methods in HTTPConnection.
 **/

@implementation MyHTTPConnection


- (BOOL)supportsMethod:(NSString *)method atPath:(NSString *)path
{
	HTTPLogTrace();
	
	// Add support for POST
    
	if ([method isEqualToString:@"POST"])
	{
		if ([path hasPrefix:@"/upload/"]){
			return YES;
		}
    }else if([method isEqualToString:@"GET"]){
        
        if([path hasPrefix:@"/list/"]){
          return YES;
        }else if ([path hasPrefix:@"/listPath/"]){
            return YES;
        }
        else if ([path hasPrefix:@"/rename/"]){
          return YES;
        }else if ([path hasPrefix:@"/delete/"]){
            return YES;
        }else if([path hasPrefix:@"/createPath"]){
            return YES;
        }else if([path hasPrefix:@"/move"]){
            return YES;
        }

    }
	
	return [super supportsMethod:method atPath:path];
}

- (BOOL)expectsRequestBodyFromMethod:(NSString *)method atPath:(NSString *)path
{
	HTTPLogTrace();
    
	// Inform HTTP server that we expect a body to accompany a POST request
	
	if([method isEqualToString:@"POST"] && [path hasPrefix:@"/upload/"]) {
        // here we need to make sure, boundary is set in header
        NSString* contentType = [request headerField:@"Content-Type"];
        NSUInteger paramsSeparator = [contentType rangeOfString:@";"].location;
        if( NSNotFound == paramsSeparator ) {
            return NO;
        }
        if( paramsSeparator >= contentType.length - 1 ) {
            return NO;
        }
        NSString* type = [contentType substringToIndex:paramsSeparator];
        if( ![type isEqualToString:@"multipart/form-data"] ) {
            // we expect multipart/form-data content type
            return NO;
        }

		// enumerate all params in content-type, and find boundary there
        NSArray* params = [[contentType substringFromIndex:paramsSeparator + 1] componentsSeparatedByString:@";"];
        for( NSString* param in params ) {
            paramsSeparator = [param rangeOfString:@"="].location;
            if( (NSNotFound == paramsSeparator) || paramsSeparator >= param.length - 1 ) {
                continue;
            }
            NSString* paramName = [param substringWithRange:NSMakeRange(1, paramsSeparator-1)];
            NSString* paramValue = [param substringFromIndex:paramsSeparator+1];
            
            if( [paramName isEqualToString: @"boundary"] ) {
                // let's separate the boundary from content-type, to make it more handy to handle
                [request setHeaderField:@"boundary" value:paramValue];
            }
        }
        // check if boundary specified
        if( nil == [request headerField:@"boundary"] )  {
            return NO;
        }
        return YES;
    }
	return [super expectsRequestBodyFromMethod:method atPath:path];
}

- (NSObject<HTTPResponse> *)httpResponseForMethod:(NSString *)method URI:(NSString *)path
{
	HTTPLogTrace();
	
	if ([method isEqualToString:@"POST"] && [path hasPrefix:@"/upload/"]){
        NSString *jsonString = @"true";
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSASCIIStringEncoding]];
	}
    else if( [method isEqualToString:@"GET"] && [path hasPrefix:@"/upload/"] ) {
        
        NSString  *tempPath =  [NSString stringWithString:path];
        NSRange oldNameRange  = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        tempPath  =  [tempPath substringFromIndex:oldNameRange.location+oldNameRange.length];
//        
//        NSString *decodeOldName =  [[tempPath
//                                     stringByReplacingOccurrencesOfString:@"+" withString:@" "]
//                                    stringByReplacingPercentEscapesUsingEncoding:NSUTF8StringEncoding];
        
		return [[HTTPFileResponse alloc] initWithFilePath: [[config uploadRoot] stringByAppendingPathComponent:tempPath] forConnection:self];
	}
    else if ([method isEqualToString:@"GET"] && [path hasPrefix:@"/createPath/"]){

//        /createPath/?currentDir=upload&folderName=test
        NSString *jsonString = @"false";//true
        
        NSRange uploadRange  = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];

        if(uploadRange.location !=NSNotFound){
            NSString *localPath = [path substringFromIndex:uploadRange.length+uploadRange.location];
            NSString *folderName;
            NSArray *tempArray = [localPath componentsSeparatedByString:@"&"];
            if([tempArray count] ==2){
                localPath = [tempArray objectAtIndex:0];
                folderName = [tempArray objectAtIndex:1];
                
                localPath = [[config uploadRoot] stringByAppendingPathComponent:localPath];
                
                tempArray = [folderName componentsSeparatedByString:@"="];
                if ([tempArray count] ==2) {
                    folderName = [tempArray objectAtIndex:1];
                    localPath = [localPath stringByAppendingPathComponent:folderName];
                    
                    NSFileManager *fileManager = [NSFileManager defaultManager];

                    NSError *error;
                    if([fileManager createDirectoryAtPath:localPath withIntermediateDirectories:YES attributes:Nil error:&error]){
                        jsonString = @"true";
                    }
                }
            }
        }
        
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSASCIIStringEncoding]];
	}
    else if([method isEqualToString:@"GET"] && [path hasPrefix:@"/list/"]) {
        
//        /list/?dir=%2Fupload
        NSString  *uploadPath = [config uploadRoot];
        NSError *error;
        
        NSRange filePathRange = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSMutableArray *localUploadedFiles = [NSMutableArray arrayWithCapacity:0];
        
        if(filePathRange.location !=NSNotFound){
            
            uploadPath = [uploadPath stringByAppendingPathComponent:[path substringFromIndex:filePathRange.location+ filePathRange.length]];
            NSArray *tempFileArray  =[fileManager contentsOfDirectoryAtPath:uploadPath error:&error];
            
            for (NSString *aFile in tempFileArray) {
                NSString *filePath = [uploadPath stringByAppendingPathComponent:aFile];
                NSDictionary *attributes = [fileManager attributesOfItemAtPath:filePath error:&error];
                
                if(attributes){
                    NSNumber *fSize = [attributes objectForKey:NSFileSize];
                    NSDate *modificationDate = [attributes objectForKey:NSFileModificationDate];
                    NSString *dateString;
                    
                    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
                    NSTimeZone *timeZone = [NSTimeZone localTimeZone];
                    [formatter setTimeZone:timeZone];
                    [formatter setDateFormat : @"yyyy-M-d H:m"];
                    dateString = [formatter stringFromDate:modificationDate];
                    
                    BOOL _isDir= NO;
                    if([[attributes objectForKey:NSFileType] isEqualToString:NSFileTypeDirectory]){
                        _isDir = YES;
                    }
                    
                    NSDictionary *aFileObject =@{@"fileName": aFile,
                                                 @"fileSize":fSize,
                                                 @"fileDate":dateString,
                                                 @"isdir":_isDir?@1:@0};
                    [localUploadedFiles addObject:aFileObject];
                }
            }
            
        }
        SBJsonWriter *jsonWriter = [[SBJsonWriter alloc] init];
        NSString *jsonString = [jsonWriter stringWithObject:localUploadedFiles];
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSUTF8StringEncoding]];
        
    }
    else if([method isEqualToString:@"GET"] && [path hasPrefix:@"/listPath/"]) {
        
//        /listPath/?dir=upload

        NSString  *uploadPath = [config uploadRoot];
        NSError *error;
        
        NSRange filePathRange = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        NSFileManager *fileManager = [NSFileManager defaultManager];
        NSMutableArray *localUploadedFiles = [NSMutableArray arrayWithCapacity:0];
        
        if(filePathRange.location !=NSNotFound){
            
            uploadPath = [uploadPath stringByAppendingPathComponent:[path substringFromIndex:filePathRange.location+ filePathRange.length]];
            NSArray *tempFileArray  =[fileManager contentsOfDirectoryAtPath:uploadPath error:&error];
            
            for (NSString *aFile in tempFileArray) {
                NSString *filePath = [uploadPath stringByAppendingPathComponent:aFile];
                NSDictionary *attributes = [fileManager attributesOfItemAtPath:filePath error:&error];
                
                if(attributes && [[attributes objectForKey:NSFileType] isEqualToString:NSFileTypeDirectory]){
                    NSNumber *fSize = [attributes objectForKey:NSFileSize];
                    NSDate *modificationDate = [attributes objectForKey:NSFileModificationDate];
                    NSString *dateString;
                    
                    NSDateFormatter *formatter = [[NSDateFormatter alloc] init];
                    NSTimeZone *timeZone = [NSTimeZone localTimeZone];
                    [formatter setTimeZone:timeZone];
                    [formatter setDateFormat : @"yyyy-M-d H:m"];
                    dateString = [formatter stringFromDate:modificationDate];
                    
                    NSDictionary *aFileObject =@{@"fileName": aFile,
                                                 @"fileSize":fSize,
                                                 @"fileDate":dateString,
                                                 @"isdir":@1};
                    [localUploadedFiles addObject:aFileObject];
                }
            }
        
        }
        SBJsonWriter *jsonWriter = [[SBJsonWriter alloc] init];
        NSString *jsonString = [jsonWriter stringWithObject:localUploadedFiles];
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSUTF8StringEncoding]];
        
    }
    else if([method isEqualToString:@"GET"] && [path hasPrefix:@"/rename/"]) {
//        /rename/?currentDir=upload/xxx.txt&newname=test1.txt
    
        NSString  *uploadPath = [config uploadRoot];
        NSRange uploadRange  = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        NSString *jsonString, *tempFilePath;

        if(uploadRange.location == NSNotFound){
            jsonString  =@"false";
        }else{
            
            tempFilePath  =  [path substringFromIndex:uploadRange.location+uploadRange.length];
    
            NSString *aNewName,*aOldName,*targetPath;
            
            NSArray *nameArray  = [tempFilePath  componentsSeparatedByString:@"&"];
            tempFilePath = [nameArray objectAtIndex:0];
            aNewName = [nameArray objectAtIndex:1];
            
            NSArray *tempArray  = [aNewName  componentsSeparatedByString:@"="];
            aNewName  =[tempArray objectAtIndex:1];
            
            tempArray  = [tempFilePath  componentsSeparatedByString:@"/"];
           
            NSString *resultString = @"";
            if ([tempArray count] > 1) {
                for (NSInteger index =0; index<tempArray.count-1; index++) {
                    resultString = [resultString stringByAppendingPathComponent:[tempArray objectAtIndex:index]];
                }
                aOldName = [tempArray objectAtIndex:tempArray.count-1];
            }else{
                aOldName = [tempArray objectAtIndex:0];
            }
            
            if ([resultString length]) {
                targetPath = [resultString stringByAppendingPathComponent:targetPath];
            }
            
//
            aNewName = [[uploadPath stringByAppendingPathComponent:targetPath] stringByAppendingPathComponent:aNewName];
            aOldName = [[uploadPath stringByAppendingPathComponent:targetPath] stringByAppendingPathComponent:aOldName];
            
            NSFileManager *fileManager = [NSFileManager defaultManager];
            NSDictionary *fileAttributes = [fileManager attributesOfItemAtPath:aOldName error:nil];
         
            if (fileAttributes == nil) {
                jsonString = @"false";
            } else{
                BOOL result = [fileManager moveItemAtPath:aOldName toPath:aNewName  error:nil];
                
                jsonString = result?@"true":@"false";
            }
        }
        
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSASCIIStringEncoding]];
        
    }
    else if([method isEqualToString:@"GET"] && [path hasPrefix:@"/delete/"]) {
//        /delete/?currentDir=%2Fupload/xxx.txt
        NSString *jsonString;
        NSString *tempFilePath;
        NSRange uploadRange  = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        if(uploadRange.location == NSNotFound){
            jsonString  =@"false";
        }else{
            tempFilePath  =  [path substringFromIndex:uploadRange.location+uploadRange.length];
        
            if ([tempFilePath length]){

                NSString  *uploadPath = [config uploadRoot];
                NSString *deleteFilePath  = [uploadPath stringByAppendingPathComponent:tempFilePath];
                NSFileManager *fileManager = [NSFileManager defaultManager];
                NSDictionary *fileAttributes = [fileManager attributesOfItemAtPath:deleteFilePath error:nil];
                
                if (fileAttributes == nil) {
                    jsonString = @"false";
                } else{
                    BOOL result  = [fileManager removeItemAtPath:deleteFilePath error:nil];
                    jsonString = result?@"true":@"false";
                }
            }
        }
        
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSASCIIStringEncoding]];
        
    }
    else if([method isEqualToString:@"GET"] && [path hasPrefix:@"/move/"]) {
        
//        /move/?currentFile=/upload/111.txt&target=test
        NSString  *tempPath,*jsonString,*targetPath;
        NSString  *uploadPath = [config uploadRoot];

        NSRange uploadRange  = [path rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];
        NSRange targetRange = [path rangeOfString:@"target=" options:NSCaseInsensitiveSearch];
        if(uploadRange.location == NSNotFound || targetRange.location == NSNotFound){
            jsonString  =@"false";
        }else{
            targetPath = [path substringFromIndex:targetRange.location+targetRange.length];
            tempPath = [path substringWithRange:NSMakeRange(uploadRange.location+uploadRange.length,
                                                            targetRange.location-uploadRange.location-1-uploadRange.length)];
            if ([tempPath length]) {
                NSArray *tempArray = [tempPath componentsSeparatedByString:@"/"];
                NSString *resultString = @"";
                if ([tempArray count] > 1) {
                    for (NSInteger index =0; index<tempArray.count-1; index++) {
                       resultString = [resultString stringByAppendingPathComponent:[tempArray objectAtIndex:index]];
                    }
                }
                
                if ([resultString length]) {
                    targetPath = [resultString stringByAppendingPathComponent:targetPath];
                }
            }
        }
        
        if ([tempPath length] && [targetPath length]){
            
            NSString *moveFilePath  = [uploadPath stringByAppendingPathComponent:tempPath];
            NSFileManager *fileManager = [NSFileManager defaultManager];
            NSDictionary *fileAttributes = [fileManager attributesOfItemAtPath:moveFilePath error:nil];
            
            NSArray *tempArray = [tempPath componentsSeparatedByString:@"/"];
            targetPath = [uploadPath stringByAppendingPathComponent:targetPath];
            
            BOOL isDirExists = NO;
            
            [fileManager fileExistsAtPath:targetPath isDirectory:&isDirExists];
            
            if (fileAttributes == nil||!isDirExists) {
                jsonString = @"false";
            } else{
                NSError *error;
                
                targetPath = [targetPath stringByAppendingPathComponent:[tempArray objectAtIndex:tempArray.count-1]];
                BOOL result  = [fileManager moveItemAtPath:moveFilePath toPath:targetPath error:&error];
                jsonString = result?@"true":@"false";
            }
        }
        
        return [[HTTPDataResponse  alloc] initWithData:[jsonString dataUsingEncoding: NSASCIIStringEncoding]];
        
    }

	
	return [super httpResponseForMethod:method URI:path];
}

- (void)prepareForBodyWithSize:(UInt64)contentLength
{
	HTTPLogTrace();
	
	// set up mime parser
    NSString* boundary = [request headerField:@"boundary"];
    parser = [[MultipartFormDataParser alloc] initWithBoundary:boundary formEncoding:NSUTF8StringEncoding];
    parser.delegate = self;

	uploadedFiles = [[NSMutableArray alloc] init];
}

- (void)processBodyData:(NSData *)postDataChunk
{
	HTTPLogTrace();
    // append data to the parser. It will invoke callbacks to let us handle
    // parsed data.
    [parser appendData:postDataChunk];
}


//-----------------------------------------------------------------
#pragma mark multipart form data parser delegate


- (void) processStartOfPartWithHeader:(MultipartMessageHeader*) header {
	// in this sample, we are not interested in parts, other then file parts.
	// check content disposition to find out filename

    MultipartMessageHeaderField* disposition = [header.fields objectForKey:@"Content-Disposition"];
	NSString* filename = [[disposition.params objectForKey:@"filename"] lastPathComponent];

    if ( (nil == filename) || [filename isEqualToString: @""] ) {
        // it's either not a file part, or
		// an empty form sent. we won't handle it.
		return;
	}
    
    NSString *uploadPath= [[request url] relativeString];
    
    if ([uploadPath length] == 0) {
        return;
    }else{
        HTTPLogVerbose(@"File will save  to %@", uploadPath);
    }
    
    NSRange pathRange = [uploadPath rangeOfString:@"upload/" options:NSCaseInsensitiveSearch];

    if(pathRange.location == NSNotFound){
        return;
    }
    
    uploadPath = [uploadPath substringFromIndex:pathRange.location+pathRange.length];
    
    
	NSString* uploadDirPath = [[config uploadRoot] stringByAppendingPathComponent:uploadPath];

	BOOL isDir = YES;
	if (![[NSFileManager defaultManager]fileExistsAtPath:uploadDirPath isDirectory:&isDir ]) {
        NSError *error;
		[[NSFileManager defaultManager]createDirectoryAtPath:uploadDirPath withIntermediateDirectories:YES attributes:nil error:&error];
        NSLog(@"%@",error);
	}
	
    NSString* filePath = [uploadDirPath stringByAppendingPathComponent: filename];
    if( [[NSFileManager defaultManager] fileExistsAtPath:filePath] ) {
        storeFile = nil;
    }
    else {
		HTTPLogVerbose(@"Saving file to %@", filePath);
		if(![[NSFileManager defaultManager] createDirectoryAtPath:uploadDirPath withIntermediateDirectories:true attributes:nil error:nil]) {
			HTTPLogError(@"Could not create directory at path: %@", filePath);
		}
		if(![[NSFileManager defaultManager] createFileAtPath:filePath contents:nil attributes:nil]) {
			HTTPLogError(@"Could not create file at path: %@", filePath);
		}
		storeFile = [NSFileHandle fileHandleForWritingAtPath:filePath];
		[uploadedFiles addObject: [NSString stringWithFormat:@"/upload/%@", filename]];
    }
}


- (void) processContent:(NSData*) data WithHeader:(MultipartMessageHeader*) header 
{
	// here we just write the output from parser to the file.
	if( storeFile ) {
		[storeFile writeData:data];
	}
}

- (void) processEndOfPartWithHeader:(MultipartMessageHeader*) header
{
	// as the file part is over, we close the file.
	[storeFile closeFile];
	storeFile = nil;
}

- (void) processPreambleData:(NSData*) data 
{
    // if we are interested in preamble data, we could process it here.

}

- (void) processEpilogueData:(NSData*) data 
{
    // if we are interested in epilogue data, we could process it here.

}

@end
